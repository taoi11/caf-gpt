/**
 * IP-based rate limiting system with hourly/daily windows and CIDR whitelists.
 * Implements sliding window counters with automated cleanup of stale entries.
 * Tracks request timestamps per IP, provides client-facing limit headers,
 * and integrates with application logging for diagnostics.
 */
import { IncomingMessage, ServerResponse } from 'http';
import { logger } from './logger';
import { IS_DEV, RATE_LIMITS } from './config';
import type { RateLimit, RateLimitInfo, NodeRateLimiter } from '../types';

/**
 * IP-based rate limiting system with hourly/daily windows and CIDR whitelists.
 * Tracks request timestamps, manages storage cleanup, and provides client-facing
 * limit information via HTTP headers.
 */
class RateLimiter implements NodeRateLimiter {
    private readonly limits: Map<string, RateLimit> = new Map();
    private cleanupInterval?: NodeJS.Timeout;

    constructor() {
        // Don't start the interval in test environments to prevent open handles
        if (process.env.NODE_ENV !== 'test') {
            this.cleanupInterval = setInterval(() => this.cleanupOldEntries(), RATE_LIMITS.CLEANUP_INTERVAL);
        }
    }

    // Implementation of NodeRateLimiter interface
    public sendLimitResponse(req: IncomingMessage, res: ServerResponse, type: string): void {
        const info = this.getLimitInfo(req);
        const window = type === 'hourly' ? info.hourly : info.daily;
        const limit = type === 'hourly' ? RATE_LIMITS.HOURLY_LIMIT : RATE_LIMITS.DAILY_LIMIT;
        
        const resetTimeSeconds = Math.ceil(window.resetIn / 1000);
        const resetTime = new Date(Date.now() + window.resetIn).toUTCString();

        res.setHeader('Retry-After', resetTimeSeconds.toString());
        res.setHeader('X-RateLimit-Limit', limit.toString());
        res.setHeader('X-RateLimit-Remaining', window.remaining.toString());
        res.setHeader('X-RateLimit-Reset', resetTime);
        
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            error: `Rate limit exceeded. Try again in ${Math.ceil(window.resetIn / 60000)} minutes.`,
            type: type
        }));
        
        logger.warn(`Rate limit exceeded: ${type}`, {
            ip: this.getClientIP(req),
            remaining: window.remaining,
            resetIn: window.resetIn
        });
    }
    
    private formatTime(ms: number): string {
        const seconds = Math.ceil(ms / 1000);
        if (seconds < 60) {
            return `${seconds} second${seconds === 1 ? '' : 's'}`;
        }
        
        const minutes = Math.ceil(seconds / 60);
        if (minutes < 60) {
            return `${minutes} minute${minutes === 1 ? '' : 's'}`;
        }
        
        const hours = Math.ceil(minutes / 60);
        return `${hours} hour${hours === 1 ? '' : 's'}`;
    }

    private cleanTimestamps(timestamps: number[], windowSize: number, now: number): number[] {
        // Remove timestamps outside the window
        const cutoff = now - windowSize;
        return timestamps
            .filter(ts => ts > cutoff)
            .slice(-RATE_LIMITS.MAX_TIMESTAMPS_PER_WINDOW);  // Keep only most recent
    }

    /**
     * Maintains rate limit state for IP addresses with hourly/daily windows
     * @param ip - Client IP address to check
     * @param now - Current timestamp in milliseconds
     * @returns RateLimit object containing timestamp arrays and cleanup state
     */
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

    // Implementation of NodeRateLimiter interface methods
    /**
     * Checks if request is allowed under current rate limits
     * @param req - Incoming HTTP request
     * @returns True if request is permitted, false if rate limited
     */
    /**
     * Checks if request is allowed under current rate limits
     * @param req - Incoming HTTP request to evaluate
     * @returns True if request is within allowed limits, false if rate limited
     */
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

    /**
     * Records successful request in rate limit windows
     * @param req - Incoming HTTP request to track
     */
    /**
     * Records successful request in rate limit windows
     * @param req - Request to track in rate limit counters
     */
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

    /**
     * Gets current rate limit state for a client
     * @param req - Request to get limits for
     * @returns Object with hourly/daily remaining counts and reset times
     */
    public getLimitInfo(req: IncomingMessage): RateLimitInfo {
        const ip = this.getClientIP(req);
        
        // If whitelisted, return unlimited
        if (this.isWhitelisted(ip)) {
            return {
                hourly: { remaining: Infinity, resetIn: 0 },
                daily: { remaining: Infinity, resetIn: 0 }
            };
        }
        
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
    private normalizeCIDR(cidr: string): string {
        return cidr.toLowerCase();
    }
    
    private isIPInCIDR(ip: string, cidr: string): boolean {
        // Simple implementation for demonstration
        // In a real implementation, we would parse the CIDR and check if IP is in the range
        const ipPrefix = ip.split('.');
        const cidrPrefix = cidr.split('/')[0].split('.');
        
        // Compare first octets (simple implementation)
        const matchLength = Math.min(ipPrefix.length, cidrPrefix.length);
        for (let i = 0; i < matchLength; i++) {
            if (ipPrefix[i] !== cidrPrefix[i]) {
                return false;
            }
        }
        
        return true;
    }
}

// Export singleton instance
export const rateLimiter = new RateLimiter(); 
