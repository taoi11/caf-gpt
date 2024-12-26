import { logger } from '../../logger';
import { IS_DEV } from '../../config';
import type { RequestWindow, RateLimitInfo } from '../../../types';

// Rate limit configuration
const HOURLY_LIMIT = 10;
const DAILY_LIMIT = 30;
const WHITELISTED_IP = [
    '131.136.0.0/16' // DND network - bypasses rate limits
];

class RateLimiter {
    private readonly limits: Map<string, RateLimitInfo> = new Map();
    private readonly cleanupInterval: NodeJS.Timeout;

    constructor() {
        // Cleanup old entries every hour
        this.cleanupInterval = setInterval(() => this.cleanup(), 3600000);
        logger.info('Rate limiter initialized');
    }

    private isWhitelisted(ip: string): boolean {
        // Basic CIDR check for whitelist
        return WHITELISTED_IP.some(cidr => {
            const [network, bits] = cidr.split('/');
            const mask = ~((1 << (32 - parseInt(bits))) - 1);
            const ipNum = this.ipToNumber(ip);
            const networkNum = this.ipToNumber(network);
            return (ipNum & mask) === (networkNum & mask);
        });
    }

    private ipToNumber(ip: string): number {
        return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
    }

    private getWindow(timestamp: number, windowSize: number): RequestWindow {
        return {
            count: 1,
            timestamp
        };
    }

    private updateWindow(window: RequestWindow, now: number, limit: number, windowSize: number): boolean {
        const timeDiff = now - window.timestamp;
        
        // If outside window, reset counter
        if (timeDiff >= windowSize) {
            window.count = 1;
            window.timestamp = now;
            return true;
        }

        // Calculate remaining requests in the sliding window
        const remainingRatio = (windowSize - timeDiff) / windowSize;
        const adjustedCount = Math.ceil(window.count * remainingRatio) + 1;

        if (adjustedCount > limit) {
            return false;
        }

        window.count = adjustedCount;
        window.timestamp = now;
        return true;
    }

    public checkLimit(ip: string): boolean {
        // Bypass rate limits in development
        if (IS_DEV) {
            logger.debug('Rate limits bypassed in development');
            return true;
        }

        if (this.isWhitelisted(ip)) {
            logger.debug(`Whitelisted IP: ${ip}`);
            return true;
        }

        const now = Date.now();
        let info = this.limits.get(ip);

        if (!info) {
            info = {
                hourly: this.getWindow(now, 3600000),
                daily: this.getWindow(now, 86400000)
            };
            this.limits.set(ip, info);
            return true;
        }

        // Check hourly limit
        const hourlyOk = this.updateWindow(info.hourly, now, HOURLY_LIMIT, 3600000);
        if (!hourlyOk) {
            logger.warn(`Hourly rate limit exceeded for IP: ${ip}`);
            return false;
        }

        // Check daily limit
        const dailyOk = this.updateWindow(info.daily, now, DAILY_LIMIT, 86400000);
        if (!dailyOk) {
            logger.warn(`Daily rate limit exceeded for IP: ${ip}`);
            return false;
        }

        return true;
    }

    private cleanup(): void {
        const now = Date.now();
        const dayAgo = now - 86400000;

        for (const [ip, info] of this.limits.entries()) {
            if (info.daily.timestamp < dayAgo) {
                this.limits.delete(ip);
                logger.debug(`Cleaned up rate limit info for IP: ${ip}`);
            }
        }
    }

    public stop(): void {
        clearInterval(this.cleanupInterval);
        logger.info('Rate limiter stopped');
    }
}

// Export singleton instance
export const rateLimiter = new RateLimiter(); 