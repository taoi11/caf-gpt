import { IncomingMessage, ServerResponse } from 'http';
import { logger } from '../../logger';
import { IS_DEV, RATE_LIMITS } from '../../config';
import type { RateLimit, RateWindow } from '../../../types';

// Constants
const HOUR = 60 * 60 * 1000; // 1 hour in milliseconds
const DAY = 24 * 60 * 60 * 1000; // 1 day in milliseconds
const MAX_IPS = 10000; // Maximum number of IPs to track

class RateLimiter {
    private readonly limits: Map<string, RateLimit> = new Map();
    private readonly ipv6Limits: Map<string, RateLimit> = new Map(); // Separate IPv6 tracking

    constructor() {
        setInterval(() => this.cleanupOldEntries(), RATE_LIMITS.CLEANUP_INTERVAL);
    }

    private cleanupOldEntries(): void {
        const now = Date.now(); // Use milliseconds directly
        
        // Helper to cleanup a map
        const cleanupMap = (map: Map<string, RateLimit>) => {
            const entries = Array.from(map.entries());
            // Sort by timestamp (newest first) and keep only MAX_IPS entries
            entries.sort((a, b) => b[1].hourly.timestamp - a[1].hourly.timestamp);
            
            map.clear();
            entries.slice(0, MAX_IPS).forEach(([ip, limit]) => {
                const hourlyExpired = now - limit.hourly.timestamp >= HOUR;
                const dailyExpired = now - limit.daily.timestamp >= DAY;
                
                if (!hourlyExpired || !dailyExpired) {
                    map.set(ip, limit);
                }
            });
        };

        cleanupMap(this.limits);
        cleanupMap(this.ipv6Limits);
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
        // Handle localhost
        if (ip === '::ffff:127.0.0.1') {
            return '127.0.0.1';
        }
        
        // Remove IPv6 prefix if present
        if (ip.startsWith('::ffff:')) {
            ip = ip.substring(7);
        }
        
        // Handle IPv6 addresses
        if (ip.includes(':')) {
            return ip; // Keep original IPv6 address
        }

        // Basic IPv4 validation and normalization
        const parts = ip.split('.');
        if (parts.length !== 4) {
            logger.warn(`Invalid IP address format: ${ip}`);
            return '0.0.0.0';
        }

        return parts.map(part => {
            const num = parseInt(part, 10);
            return (num >= 0 && num <= 255) ? num : 0;
        }).join('.');
    }

    // Improved whitelist check
    private isWhitelisted(ip: string): boolean {
        // Only process IPv4 addresses for whitelist
        if (ip.includes(':')) {
            return false;
        }

        return RATE_LIMITS.WHITELISTED_CIDRS.some(cidr => 
            this.isIPInCIDR(ip, cidr)
        );
    }

    private checkWindow(window: RateWindow, now: number, limit: number, size: number): boolean {
        const timeDiff = now - window.timestamp;
        
        // If outside window, reset
        if (timeDiff >= size) {
            window.count = 1;
            window.timestamp = now;
            return true;
        }

        // Use precise timestamp-based counting
        if (window.count >= limit) {
            return false;
        }

        window.count++;
        return true;
    }

    public canMakeRequest(req: IncomingMessage): boolean {
        if (IS_DEV) return true;

        const rawIP = req.socket.remoteAddress || '0.0.0.0';
        const ip = this.normalizeIP(rawIP);
        
        if (this.isWhitelisted(ip)) return true;

        const now = Date.now();
        const limitsMap = ip.includes(':') ? this.ipv6Limits : this.limits;
        let limit = limitsMap.get(ip);

        if (!limit) return true;

        return this.checkWindowLimit(limit.hourly, now, RATE_LIMITS.HOURLY_LIMIT, HOUR) &&
               this.checkWindowLimit(limit.daily, now, RATE_LIMITS.DAILY_LIMIT, DAY);
    }

    // New method to only check limits without incrementing
    private checkWindowLimit(window: RateWindow, now: number, limit: number, size: number): boolean {
        const timeDiff = now - window.timestamp;
        return timeDiff >= size || window.count < limit;
    }

    // Track only successful API calls
    public trackSuccessfulRequest(req: IncomingMessage): void {
        if (IS_DEV) return;

        const rawIP = req.socket.remoteAddress || '0.0.0.0';
        const ip = this.normalizeIP(rawIP);
        
        if (this.isWhitelisted(ip)) return;

        const now = Date.now();
        const limitsMap = ip.includes(':') ? this.ipv6Limits : this.limits;
        let limit = limitsMap.get(ip);

        if (!limit) {
            limit = {
                ip,
                hourly: { count: 1, timestamp: now },
                daily: { count: 1, timestamp: now }
            };
            limitsMap.set(ip, limit);
            return;
        }

        this.incrementWindow(limit.hourly, now, HOUR);
        this.incrementWindow(limit.daily, now, DAY);
    }

    // Helper to increment window counts
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
    } | null {
        const limit = this.limits.get(ip);
        if (!limit) {
            return {
                hourly: { remaining: RATE_LIMITS.HOURLY_LIMIT, resetIn: HOUR },
                daily: { remaining: RATE_LIMITS.DAILY_LIMIT, resetIn: DAY }
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
            hourly: getWindowInfo(limit.hourly, RATE_LIMITS.HOURLY_LIMIT, HOUR),
            daily: getWindowInfo(limit.daily, RATE_LIMITS.DAILY_LIMIT, DAY)
        };
    }
}

// Export singleton instance
export const rateLimiter = new RateLimiter(); 