import { IncomingMessage, ServerResponse } from 'http';
import { logger } from '../../logger';
import { IS_DEV, RATE_LIMITS } from '../../config';
import type { RateLimit, RateWindow } from '../../../types';

// Rate limit time windows
const HOUR = 60 * 60 * 1000; // 1 hour in milliseconds
const DAY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

class RateLimiter {
    private readonly limits: Map<string, RateLimit> = new Map();

    constructor() {
        // Start cleanup interval using config value
        setInterval(() => this.cleanupOldEntries(), RATE_LIMITS.CLEANUP_INTERVAL);
    }

    private cleanupOldEntries(): void {
        const now = this.getUTCTimestamp();
        for (const [ip, limit] of this.limits.entries()) {
            // Check if both windows are at max count or expired
            const hourlyExpired = now - limit.hourly.timestamp >= HOUR;
            const dailyExpired = now - limit.daily.timestamp >= DAY;
            
            if (hourlyExpired && dailyExpired) {
                this.limits.delete(ip);
                logger.debug(`Cleaned up rate limit entry for IP: ${ip}`);
            }
        }
    }

    private isIPInCIDR(ip: string, cidr: string): boolean {
        const [range, bits] = cidr.split('/');
        const mask = ~(2 ** (32 - parseInt(bits)) - 1);
        
        const ipParts = ip.split('.').map(Number);
        const rangeParts = range.split('.').map(Number);
        
        const ipNum = (ipParts[0] << 24) + (ipParts[1] << 16) + (ipParts[2] << 8) + ipParts[3];
        const rangeNum = (rangeParts[0] << 24) + (rangeParts[1] << 16) + (rangeParts[2] << 8) + rangeParts[3];
        
        return (ipNum & mask) === (rangeNum & mask);
    }

    // Normalize IPv4 address to standard format
    private normalizeIP(ip: string): string {
        // Handle IPv6 addresses
        if (ip.includes(':')) {
            logger.debug('IPv6 address detected, using fallback');
            return '0.0.0.0';
        }

        // Basic IPv4 validation and normalization
        const parts = ip.split('.');
        if (parts.length !== 4) {
            logger.warn(`Invalid IP address format: ${ip}`);
            return '0.0.0.0';
        }

        // Normalize each octet
        const normalized = parts.map(part => {
            const num = parseInt(part, 10);
            return (num >= 0 && num <= 255) ? num : 0;
        }).join('.');

        return normalized;
    }

    // Improved whitelist check
    private isWhitelisted(ip: string): boolean {
        // Only process IPv4 addresses
        if (ip.includes(':')) {
            return false;
        }

        // Check if IP is in any whitelisted CIDR range
        const isWhitelisted = RATE_LIMITS.WHITELISTED_CIDRS.some(cidr => 
            this.isIPInCIDR(ip, cidr)
        );

        if (isWhitelisted) {
            logger.debug(`Whitelisted IP detected: ${ip}`);
        }
        return isWhitelisted;
    }

    private checkWindow(window: RateWindow, now: number, limit: number, size: number): boolean {
        const timeDiff = now - window.timestamp;
        
        // If outside window, reset
        if (timeDiff >= size) {
            window.count = 1; // Set to 1 since we're consuming the request
            window.timestamp = now;
            return true;
        }

        // Calculate remaining requests in sliding window
        const remainingRatio = (size - timeDiff) / size;
        const adjustedCount = Math.ceil(window.count * remainingRatio) + 1;

        if (adjustedCount > limit) {
            return false;
        }

        window.count = adjustedCount;
        window.timestamp = now;
        return true;
    }

    public canMakeRequest(req: IncomingMessage): boolean {
        // Skip rate limiting in development
        if (IS_DEV) {
            return true;
        }

        // Get and normalize IP address
        const rawIP = req.socket.remoteAddress || '0.0.0.0';
        const ip = this.normalizeIP(rawIP);

        // Whitelist check with normalized IP
        if (this.isWhitelisted(ip)) {
            return true;
        }

        const now = this.getUTCTimestamp();
        let limit = this.limits.get(ip);

        // If no previous requests, allow it
        if (!limit) {
            return true;
        }

        // Just check if we're at limit, don't increment
        const hourlyOk = this.checkWindowLimit(limit.hourly, now, RATE_LIMITS.HOURLY_LIMIT, HOUR);
        const dailyOk = this.checkWindowLimit(limit.daily, now, RATE_LIMITS.DAILY_LIMIT, DAY);

        return hourlyOk && dailyOk;
    }

    // New method to only check limits without incrementing
    private checkWindowLimit(window: RateWindow, now: number, limit: number, size: number): boolean {
        const timeDiff = now - Math.floor(window.timestamp / 1000) * 1000;
        
        // If outside window, it's ok
        if (timeDiff >= size) {
            return true;
        }

        // Simple count check
        return window.count < limit;
    }

    // Track only successful API calls
    public trackSuccessfulRequest(req: IncomingMessage): void {
        if (IS_DEV) return;

        const rawIP = req.socket.remoteAddress || '0.0.0.0';
        const ip = this.normalizeIP(rawIP);
        
        if (this.isWhitelisted(ip)) return;

        const now = this.getUTCTimestamp();
        let limit = this.limits.get(ip);

        // Initialize or update limits
        if (!limit) {
            limit = {
                ip,
                hourly: { count: 1, timestamp: now },
                daily: { count: 1, timestamp: now }
            };
            this.limits.set(ip, limit);
            return;
        }

        // Update both windows
        this.incrementWindow(limit.hourly, now, HOUR);
        this.incrementWindow(limit.daily, now, DAY);
    }

    // Helper to increment window counts
    private incrementWindow(window: RateWindow, now: number, size: number): void {
        const timeDiff = now - Math.floor(window.timestamp / 1000) * 1000;
        
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
    } | null {
        const limit = this.limits.get(ip);
        if (!limit) {
            return {
                hourly: { remaining: RATE_LIMITS.HOURLY_LIMIT, resetIn: HOUR },
                daily: { remaining: RATE_LIMITS.DAILY_LIMIT, resetIn: DAY }
            };
        }

        const now = this.getUTCTimestamp();
        const getWindowInfo = (window: RateWindow, limit: number, size: number) => {
            const timeDiff = now - Math.floor(window.timestamp / 1000) * 1000;
            const remainingRatio = (size - timeDiff) / size;
            const adjustedCount = Math.ceil(window.count * remainingRatio);
            
            return {
                remaining: Math.max(0, limit - adjustedCount),
                resetIn: Math.max(0, size - timeDiff)
            };
        };

        return {
            hourly: getWindowInfo(limit.hourly, RATE_LIMITS.HOURLY_LIMIT, HOUR),
            daily: getWindowInfo(limit.daily, RATE_LIMITS.DAILY_LIMIT, DAY)
        };
    }

    // Helper to get UTC timestamp in seconds
    private getUTCTimestamp(): number {
        return Math.floor(Date.now() / 1000) * 1000; // Floor to nearest second
    }
}

// Export singleton instance
export const rateLimiter = new RateLimiter(); 