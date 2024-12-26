import { IncomingMessage, ServerResponse } from 'http';
import { logger } from '../../logger';
import { IS_DEV } from '../../config';
import type { RateLimit, RateWindow } from '../../../types';

// Rate limit configuration
const HOUR = 3600000; // 1 hour in milliseconds
const DAY = 86400000; // 24 hours in milliseconds
const HOURLY_LIMIT = 10;
const DAILY_LIMIT = 30;
const WHITELISTED_SUBNET = '131.136'; // DND network prefix

class RateLimiter {
    private readonly limits: Map<string, RateLimit> = new Map();

    private checkWindow(window: RateWindow, now: number, limit: number, size: number): boolean {
        const timeDiff = now - window.timestamp;
        
        // If outside window, reset
        if (timeDiff >= size) {
            window.count = 1;
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

    public checkRateLimit(req: IncomingMessage, res: ServerResponse): boolean {
        // Skip rate limiting in development
        if (IS_DEV) {
            return true;
        }

        const ip = req.socket.remoteAddress || '0.0.0.0';

        // Whitelist check
        if (ip.startsWith(WHITELISTED_SUBNET)) {
            logger.debug(`Whitelisted IP: ${ip}`);
            return true;
        }

        const now = Date.now();
        let limit = this.limits.get(ip);

        // First request from this IP
        if (!limit) {
            limit = {
                ip,
                hourly: { count: 1, timestamp: now },
                daily: { count: 1, timestamp: now }
            };
            this.limits.set(ip, limit);
            return true;
        }

        // Check hourly limit
        if (!this.checkWindow(limit.hourly, now, HOURLY_LIMIT, HOUR)) {
            logger.warn(`Hourly rate limit exceeded for IP: ${ip}`);
            this.sendLimitResponse(res, 'hourly');
            return false;
        }

        // Check daily limit
        if (!this.checkWindow(limit.daily, now, DAILY_LIMIT, DAY)) {
            logger.warn(`Daily rate limit exceeded for IP: ${ip}`);
            this.sendLimitResponse(res, 'daily');
            return false;
        }

        return true;
    }

    private sendLimitResponse(res: ServerResponse, window: 'hourly' | 'daily'): void {
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
                hourly: { remaining: HOURLY_LIMIT, resetIn: HOUR },
                daily: { remaining: DAILY_LIMIT, resetIn: DAY }
            };
        }

        const now = Date.now();
        const getWindowInfo = (window: RateWindow, limit: number, size: number) => {
            const timeDiff = now - window.timestamp;
            const remainingRatio = (size - timeDiff) / size;
            const adjustedCount = Math.ceil(window.count * remainingRatio);
            
            return {
                remaining: Math.max(0, limit - adjustedCount),
                resetIn: Math.max(0, size - timeDiff)
            };
        };

        return {
            hourly: getWindowInfo(limit.hourly, HOURLY_LIMIT, HOUR),
            daily: getWindowInfo(limit.daily, DAILY_LIMIT, DAY)
        };
    }
}

// Export singleton instance
export const rateLimiter = new RateLimiter(); 