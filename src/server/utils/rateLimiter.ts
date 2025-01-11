import { IncomingMessage, ServerResponse } from 'http';
import { logger } from './logger.js';
import { IS_DEV, RATE_LIMITS } from './config.js';
import type { RateLimit, RateWindow } from './types';

// Constants
const HOUR = 60 * 60 * 1000; // 1 hour in milliseconds
const DAY = 24 * 60 * 60 * 1000; // 1 day in milliseconds
const MAX_IPS = 10000; // Maximum number of IPs to track

class RateLimiter {
    private readonly limits: Map<string, RateLimit> = new Map();
    private readonly ipv6Limits: Map<string, RateLimit> = new Map(); // Separate IPv6 tracking
    private cleanupInterval?: NodeJS.Timeout;

    constructor() {
        this.cleanupInterval = setInterval(() => this.cleanupOldEntries(), RATE_LIMITS.CLEANUP_INTERVAL);
    }

    private cleanupOldEntries(): void {
        const now = Date.now();
        const entries = Array.from(this.limits.entries());
        
        // Sort by timestamp (newest first) and keep only MAX_IPS entries
        entries.sort((a, b) => b[1].hourly.timestamp - a[1].hourly.timestamp);
        
        this.limits.clear();
        entries.slice(0, MAX_IPS).forEach(([ip, limit]) => {
            const hourlyExpired = now - limit.hourly.timestamp >= HOUR;
            const dailyExpired = now - limit.daily.timestamp >= DAY;
            
            if (!hourlyExpired || !dailyExpired) {
                this.limits.set(ip, limit);
            }
        });
    }

    // CIDR validation methods
    private validateCIDR(cidr: string): boolean {
        try {
            const [ip, prefix] = cidr.split('/');
            const prefixNum = parseInt(prefix, 10);
            
            if (prefixNum < 0 || prefixNum > 32) return false;
            
            const octets = ip.split('.');
            if (octets.length !== 4) return false;
            
            return octets.every(octet => {
                const num = parseInt(octet, 10);
                return !isNaN(num) && num >= 0 && num <= 255;
            });
        } catch {
            return false;
        }
    }

    private normalizeCIDR(cidr: string): string {
        if (!this.validateCIDR(cidr)) {
            logger.error(`Invalid CIDR notation: ${cidr}`);
            return cidr; // Return original to avoid breaking functionality
        }
        
        try {
            const [ip, prefix] = cidr.split('/');
            const normalizedIP = ip.split('.')
                .map(octet => parseInt(octet, 10))
                .join('.');
                
            return `${normalizedIP}/${prefix}`;
        } catch (error) {
            logger.error('CIDR normalization failed', {
                error: error instanceof Error ? error.message : String(error)
            });
            return cidr;
        }
    }

    private isIPInCIDR(ip: string, cidr: string): boolean {
        try {
            const [range, bits] = cidr.split('/');
            const mask = ~(2 ** (32 - parseInt(bits)) - 1);
            
            const ipNum = this.ipToInt(ip);
            const rangeNum = this.ipToInt(range);
            
            return (ipNum & mask) === (rangeNum & mask);
        } catch (error) {
            logger.error('CIDR check failed', {
                error: error instanceof Error ? error.message : String(error)
            });
            return false;
        }
    }

    private ipToInt(ip: string): number {
        const parts = ip.split('.').map(part => parseInt(part, 10));
        return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
    }

    // Normalize IPv4 address to standard format
    private normalizeIP(ip: string): string {
        logger.debug(`Normalizing IP: ${ip}`);
        
        // Handle IPv4-mapped IPv6 addresses
        if (ip.startsWith('::ffff:')) {
            const normalized = ip.substring(7);
            logger.debug(`Normalized IPv4-mapped address to ${normalized}`);
            return normalized;
        }
        
        // Handle localhost IPv6
        if (ip === '::1') {
            logger.debug('Normalized localhost IPv6 to IPv4');
            return '127.0.0.1';
        }

        // For all other IPs, just normalize format
        const normalized = ip.toLowerCase();
        logger.debug(`Normalized IP format: ${normalized}`);
        return normalized;
    }

    // Update isWhitelisted to use new CIDR methods
    private isWhitelisted(ip: string): boolean {
        if (ip.includes(':')) {
            return false;
        }

        return RATE_LIMITS.WHITELISTED_CIDRS.some(cidr => {
            const normalizedCIDR = this.normalizeCIDR(cidr);
            return this.isIPInCIDR(ip, normalizedCIDR);
        });
    }

    private checkWindow(window: RateWindow, now: number, limit: number, size: number): boolean {
        const timeDiff = now - window.timestamp;
        
        // If the window has expired, reset it
        if (timeDiff >= size) {
            window.count = 1; // Set to 1 instead of incrementing
            window.timestamp = now;
            return true;
        }

        // If we're within the window, check if we've hit the limit
        if (window.count >= limit) {
            return false;
        }

        // Only increment the count here, not in checkLimit
        window.count++;
        return true;
    }

    // New method to only check limits without incrementing
    private checkWindowLimit(window: RateWindow, now: number, limit: number, size: number): boolean {
        const timeDiff = now - window.timestamp;
        return timeDiff >= size || window.count < limit;
    }

    private isCloudflareRequest(req: IncomingMessage): boolean {
        return !!(req.headers['cf-ray'] || req.headers['cf-worker']);
    }

    private getCloudflareIP(req: IncomingMessage): string | null {
        const ip = req.headers['cf-connecting-ip'];
        return typeof ip === 'string' ? ip.trim() : null;
    }

    private validateRequest(req: IncomingMessage): {
        ip: string;
        warnings: string[];
    } {
        const warnings: string[] = [];
        
        // Get Cloudflare IP first
        const cfIP = this.getCloudflareIP(req);
        if (!cfIP) {
            warnings.push('Missing CF-Connecting-IP header');
            // Only log headers in development
            if (IS_DEV) {
                logger.debug('Headers debug:', { headers: req.headers });
            }
        }

        // In production, only trust Cloudflare headers
        if (!IS_DEV) {
            return { 
                ip: cfIP || '0.0.0.0',
                warnings 
            };
        }

        // In development, fallback to socket address
        const ip = cfIP || req.socket.remoteAddress || '0.0.0.0';
        return { ip, warnings };
    }

    private getClientIP(req: IncomingMessage): string {
        const { ip, warnings } = this.validateRequest(req);
        
        // Log any validation warnings
        warnings.forEach(warning => {
            logger.warn('Cloudflare header warning', { 
                warning,
                ip,
                headers: IS_DEV ? req.headers : undefined
            });
        });

        return this.normalizeIP(ip);
    }

    // Public method to get client IP
    public getIP(req: IncomingMessage): string {
        return this.getClientIP(req);
    }

    private getLimitsMap(ip: string): Map<string, RateLimit> {
        // If it's an IPv4 address or IPv4-mapped IPv6, use IPv4 map
        if (!ip.includes(':') || ip.startsWith('::ffff:')) {
            logger.debug(`Using IPv4 limits map for ${ip}`);
            return this.limits;
        }
        // Otherwise use IPv6 map
        logger.debug(`Using IPv6 limits map for ${ip}`);
        return this.ipv6Limits;
    }

    public canMakeRequest(req: IncomingMessage): boolean {
        const ip = this.getClientIP(req);
        logger.debug(`Checking rate limit for IP: ${ip}`);
        
        if (this.isWhitelisted(ip)) return true;

        const now = Date.now();
        let limit = this.limits.get(ip);

        if (!limit) {
            limit = {
                ip,
                hourly: { count: 0, timestamp: now },
                daily: { count: 0, timestamp: now }
            };
            this.limits.set(ip, limit);
        }

        return this.checkWindowLimit(limit.hourly, now, RATE_LIMITS.HOURLY_LIMIT, HOUR) &&
               this.checkWindowLimit(limit.daily, now, RATE_LIMITS.DAILY_LIMIT, DAY);
    }

    public trackSuccessfulRequest(req: IncomingMessage): void {
        const ip = this.getClientIP(req);
        logger.debug(`Tracking successful request for IP: ${ip}`);
        
        if (this.isWhitelisted(ip)) return;

        const now = Date.now();
        let limit = this.limits.get(ip);

        if (!limit) {
            limit = {
                ip,
                hourly: { count: 1, timestamp: now },
                daily: { count: 1, timestamp: now }
            };
            this.limits.set(ip, limit);
            return;
        }

        this.checkWindow(limit.hourly, now, RATE_LIMITS.HOURLY_LIMIT, HOUR);
        this.checkWindow(limit.daily, now, RATE_LIMITS.DAILY_LIMIT, DAY);
    }

    private incrementWindow(window: RateWindow, now: number, size: number): void {
        const timeDiff = now - window.timestamp;
        if (timeDiff >= size) {
            window.count = 1;
            window.timestamp = now;
        } else {
            window.count++;
        }
    }

    public sendLimitResponse(req: IncomingMessage, res: ServerResponse, window: 'hourly' | 'daily'): void {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: `${window.charAt(0).toUpperCase() + window.slice(1)} rate limit exceeded. Please try again later.`
        }));
    }

    // Get current limit info for an IP
    public getLimitInfo(ip: string): { 
        hourly: { remaining: number; resetIn: number };
        daily: { remaining: number; resetIn: number };
    } {
        const normalizedIP = this.normalizeIP(ip);
        const limit = this.limits.get(normalizedIP);
        const now = Date.now();

        if (!limit) {
            return {
                hourly: { remaining: RATE_LIMITS.HOURLY_LIMIT, resetIn: HOUR },
                daily: { remaining: RATE_LIMITS.DAILY_LIMIT, resetIn: DAY }
            };
        }

        const getWindowInfo = (window: RateWindow, limit: number, size: number) => {
            const timeDiff = now - window.timestamp;
            if (timeDiff >= size) {
                // Window has expired, full limits available
                return {
                    remaining: limit,
                    resetIn: size
                };
            }
            return {
                remaining: Math.max(0, limit - window.count),
                resetIn: Math.max(0, size - timeDiff)
            };
        };

        return {
            hourly: getWindowInfo(limit.hourly, RATE_LIMITS.HOURLY_LIMIT, HOUR),
            daily: getWindowInfo(limit.daily, RATE_LIMITS.DAILY_LIMIT, DAY)
        };
    }

    public checkLimit(ip: string): boolean {
        const normalizedIP = this.normalizeIP(ip);
        const limit = this.limits.get(normalizedIP);
        const now = Date.now();

        if (!limit) {
            const newLimit = {
                ip: normalizedIP,
                hourly: { count: 0, timestamp: now },
                daily: { count: 0, timestamp: now }
            };
            this.limits.set(normalizedIP, newLimit);
            return true;
        }

        return this.checkWindowLimit(limit.hourly, now, RATE_LIMITS.HOURLY_LIMIT, HOUR) &&
               this.checkWindowLimit(limit.daily, now, RATE_LIMITS.DAILY_LIMIT, DAY);
    }

    public stopCleanup(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = undefined;
        }
    }
}

// Export singleton instance
export const rateLimiter = new RateLimiter(); 