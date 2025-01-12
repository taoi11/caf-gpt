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
            return cidr;
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

    // Normalize IP to standard format
    private normalizeIP(ip: string): string {
        return ip.toLowerCase();
    }

    private getCloudflareIP(req: IncomingMessage): string {
        const ip = req.headers['cf-connecting-ip'];
        return typeof ip === 'string' ? ip.trim() : '0.0.0.0';
    }

    private validateRequest(req: IncomingMessage): {
        ip: string;
        warnings: string[];
    } {
        const warnings: string[] = [];
        const ip = this.getCloudflareIP(req);
        
        if (ip === '0.0.0.0') {
            warnings.push('Missing CF-Connecting-IP header');
            logger.warn('Missing CF-Connecting-IP header', {
                headers: IS_DEV ? req.headers : undefined
            });
        }
        
        return { ip, warnings };
    }

    private isWhitelisted(ip: string): boolean {
        return RATE_LIMITS.WHITELISTED_CIDRS.some(cidr => {
            const normalizedCIDR = this.normalizeCIDR(cidr);
            return this.isIPInCIDR(ip, normalizedCIDR);
        });
    }

    private checkWindow(window: RateWindow, now: number, limit: number, size: number): boolean {
        const timeDiff = now - window.timestamp;
        
        // If the window has expired, reset it
        if (timeDiff >= size) {
            window.count = 1;
            window.timestamp = now;
            return true;
        }

        // If we're within the window, check if we've hit the limit
        if (window.count >= limit) {
            return false;
        }

        window.count++;
        return true;
    }

    private checkWindowLimit(window: RateWindow, now: number, limit: number, size: number): boolean {
        const timeDiff = now - window.timestamp;
        return timeDiff >= size || window.count < limit;
    }

    private getClientIP(req: IncomingMessage): string {
        const { ip, warnings } = this.validateRequest(req);
        
        warnings.forEach(warning => {
            logger.warn('Rate limit warning', { 
                warning,
                ip,
                headers: IS_DEV ? req.headers : undefined
            });
        });

        return this.normalizeIP(ip);
    }

    public getIP(req: IncomingMessage): string {
        return this.getClientIP(req);
    }

    public canMakeRequest(req: IncomingMessage): boolean {
        const ip = this.getClientIP(req);
        logger.debug('Rate limit check', {
            ip,
            cfIP: req.headers['cf-connecting-ip'],
            isWhitelisted: this.isWhitelisted(ip),
            currentLimits: this.limits.get(ip)
        });
        
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
        logger.debug('Tracking request', {
            ip,
            isWhitelisted: this.isWhitelisted(ip)
        });
        
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

    public sendLimitResponse(req: IncomingMessage, res: ServerResponse, window: 'hourly' | 'daily'): void {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: `${window.charAt(0).toUpperCase() + window.slice(1)} rate limit exceeded. Please try again later.`
        }));
    }

    public getLimitInfo(req: IncomingMessage): { 
        hourly: { remaining: number; resetIn: number };
        daily: { remaining: number; resetIn: number };
    } {
        const ip = this.getClientIP(req);
        const limit = this.limits.get(ip);
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

    public stopCleanup(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = undefined;
        }
    }
}

// Export singleton instance
export const rateLimiter = new RateLimiter(); 