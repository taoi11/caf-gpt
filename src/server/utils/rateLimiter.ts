import { IncomingMessage, ServerResponse } from 'http';
import { logger } from './logger.js';
import { IS_DEV, RATE_LIMITS } from './config.js';
import type { RateLimit, RateWindow } from '../types.js';

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

    private cleanTimestamps(timestamps: number[], windowSize: number, now: number): number[] {
        // Remove timestamps outside the window
        const cutoff = now - windowSize;
        return timestamps
            .filter(ts => ts > cutoff)
            .slice(-RATE_LIMITS.MAX_TIMESTAMPS_PER_WINDOW);  // Keep only most recent
    }

    private cleanupWindows(limit: RateLimit, now: number): void {
        limit.hourly.timestamps = this.cleanTimestamps(
            limit.hourly.timestamps, 
            RATE_LIMITS.HOUR, 
            now
        );
        limit.daily.timestamps = this.cleanTimestamps(
            limit.daily.timestamps, 
            RATE_LIMITS.DAY, 
            now
        );
        limit.lastCleanup = now;
    }

    private isWindowExceeded(timestamps: number[], windowSize: number, limit: number, now: number): boolean {
        const cutoff = now - windowSize;
        const validRequests = timestamps.filter(ts => ts > cutoff).length;
        return validRequests >= limit;
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

    private normalizeIP(ip: string): string {
        return ip.toLowerCase();
    }

    private isWhitelisted(ip: string): boolean {
        return RATE_LIMITS.WHITELISTED_CIDRS.some(cidr => {
            const normalizedCIDR = this.normalizeCIDR(cidr);
            return this.isIPInCIDR(ip, normalizedCIDR);
        });
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

    public canMakeRequest(req: IncomingMessage): boolean {
        const ip = this.getClientIP(req);
        if (this.isWhitelisted(ip)) return true;

        const now = Date.now();
        let limit = this.limits.get(ip);

        if (!limit) {
            limit = {
                ip,
                hourly: { timestamps: [] },
                daily: { timestamps: [] },
                lastCleanup: now
            };
            this.limits.set(ip, limit);
            return true;
        }

        // Clean old timestamps if needed
        if (now - limit.lastCleanup > RATE_LIMITS.CLEANUP_INTERVAL) {
            this.cleanupWindows(limit, now);
        }

        // Check both windows
        return !this.isWindowExceeded(limit.hourly.timestamps, RATE_LIMITS.HOUR, RATE_LIMITS.HOURLY_LIMIT, now) &&
               !this.isWindowExceeded(limit.daily.timestamps, RATE_LIMITS.DAY, RATE_LIMITS.DAILY_LIMIT, now);
    }

    public trackSuccessfulRequest(req: IncomingMessage): void {
        const ip = this.getClientIP(req);
        if (this.isWhitelisted(ip)) return;

        const now = Date.now();
        let limit = this.limits.get(ip);

        if (!limit) {
            limit = {
                ip,
                hourly: { timestamps: [now] },
                daily: { timestamps: [now] },
                lastCleanup: now
            };
            this.limits.set(ip, limit);
            return;
        }

        // Clean if needed
        if (now - limit.lastCleanup > RATE_LIMITS.CLEANUP_INTERVAL) {
            this.cleanupWindows(limit, now);
        }

        // Add new timestamp to both windows
        limit.hourly.timestamps.push(now);
        limit.daily.timestamps.push(now);

        // Log window state in dev mode
        if (IS_DEV) {
            this.logWindowState(ip, limit);
        }
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
                hourly: { remaining: RATE_LIMITS.HOURLY_LIMIT, resetIn: RATE_LIMITS.HOUR },
                daily: { remaining: RATE_LIMITS.DAILY_LIMIT, resetIn: RATE_LIMITS.DAY }
            };
        }

        // Clean if needed
        if (now - limit.lastCleanup > RATE_LIMITS.CLEANUP_INTERVAL) {
            this.cleanupWindows(limit, now);
        }

        const getWindowInfo = (timestamps: number[], windowSize: number, limit: number) => {
            const validTimestamps = timestamps.filter(ts => ts > now - windowSize);
            const remaining = Math.max(0, limit - validTimestamps.length);
            
            // If we have timestamps, calculate reset time based on oldest valid timestamp
            const resetIn = validTimestamps.length > 0
                ? Math.max(0, (validTimestamps[0] + windowSize) - now)
                : windowSize;

            return { remaining, resetIn };
        };

        return {
            hourly: getWindowInfo(limit.hourly.timestamps, RATE_LIMITS.HOUR, RATE_LIMITS.HOURLY_LIMIT),
            daily: getWindowInfo(limit.daily.timestamps, RATE_LIMITS.DAY, RATE_LIMITS.DAILY_LIMIT)
        };
    }

    private logWindowState(ip: string, limit: RateLimit): void {
        if (!IS_DEV) return;

        const now = Date.now();
        logger.debug('Rate limit window state', {
            ip,
            hourly: {
                count: limit.hourly.timestamps.length,
                validCount: limit.hourly.timestamps.filter(ts => ts > now - RATE_LIMITS.HOUR).length,
                oldestTimestamp: new Date(Math.min(...limit.hourly.timestamps)).toISOString(),
                newestTimestamp: new Date(Math.max(...limit.hourly.timestamps)).toISOString()
            },
            daily: {
                count: limit.daily.timestamps.length,
                validCount: limit.daily.timestamps.filter(ts => ts > now - RATE_LIMITS.DAY).length,
                oldestTimestamp: new Date(Math.min(...limit.daily.timestamps)).toISOString(),
                newestTimestamp: new Date(Math.max(...limit.daily.timestamps)).toISOString()
            },
            lastCleanup: new Date(limit.lastCleanup).toISOString()
        });
    }

    private cleanupOldEntries(): void {
        const now = Date.now();
        const entries = Array.from(this.limits.entries());
        
        this.limits.clear();
        entries
            .filter(([_, limit]) => {
                // Keep entry if it has recent timestamps
                const hasRecentHourly = limit.hourly.timestamps.some(ts => ts > now - RATE_LIMITS.HOUR);
                const hasRecentDaily = limit.daily.timestamps.some(ts => ts > now - RATE_LIMITS.DAY);
                return hasRecentHourly || hasRecentDaily;
            })
            .slice(0, RATE_LIMITS.MAX_IPS)  // Keep only MAX_IPS most recent entries
            .forEach(([ip, limit]) => {
                this.cleanupWindows(limit, now);
                this.limits.set(ip, limit);
            });
    }

    public stopCleanup(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = undefined;
        }
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
}

// Export singleton instance
export const rateLimiter = new RateLimiter(); 