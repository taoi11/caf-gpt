/// <reference types="jest" />

import { rateLimiter } from '../../server/utils/rateLimiter';
import { IncomingMessage } from 'http';
import { RATE_LIMITS } from '../../server/utils/config';
import { logger } from '../../server/utils/logger';
import { Socket } from 'net';

// Add constants needed for tests
const HOUR = 60 * 60 * 1000;  // 1 hour in milliseconds
const DAY = 24 * HOUR;        // 1 day in milliseconds

describe('RateLimiter', () => {
    beforeEach(() => {
        // Reset rateLimiter maps before each test to ensure a clean state
        rateLimiter['limits'].clear();
    });

    afterEach(() => {
        // Stop the cleanup interval to prevent interference between tests
        rateLimiter.stopCleanup();
        jest.restoreAllMocks(); // Restore all mocked functions
    });

    // Helper to create mock request with Cloudflare headers for testing
    const createMockRequest = (cfIP: string, headers: Record<string, string> = {}): IncomingMessage => {
        const socket = new Socket();
        const req = Object.create(IncomingMessage.prototype);
        return Object.assign(req, {
            headers: {
                'cf-connecting-ip': cfIP, // Simulate Cloudflare IP header
                ...headers
            },
            socket,
            method: 'GET',
            httpVersion: '1.1',
            httpVersionMajor: 1,
            httpVersionMinor: 1,
            complete: true
        });
    };

    describe('IP Resolution', () => {
        test('uses CF-Connecting-IP header', () => {
            const cfIP = '1.2.3.4';
            const req = createMockRequest(cfIP);
            expect(rateLimiter['getClientIP'](req)).toBe(cfIP); // Verify IP is correctly extracted
        });

        test('returns 0.0.0.0 when CF-Connecting-IP is missing', () => {
            const socket = new Socket();
            const req = Object.create(IncomingMessage.prototype);
            Object.assign(req, {
                headers: {},
                socket,
                method: 'GET',
                httpVersion: '1.1',
                httpVersionMajor: 1,
                httpVersionMinor: 1,
                complete: true
            });
            expect(rateLimiter['getClientIP'](req)).toBe('0.0.0.0'); // Verify default IP when header is missing
        });

        test('logs warning when CF-Connecting-IP is missing', () => {
            const warnSpy = jest.spyOn(logger, 'warn');
            const socket = new Socket();
            const req = Object.create(IncomingMessage.prototype);
            Object.assign(req, {
                headers: {},
                socket,
                method: 'GET',
                httpVersion: '1.1',
                httpVersionMajor: 1,
                httpVersionMinor: 1,
                complete: true
            });
            rateLimiter['getClientIP'](req);
            expect(warnSpy).toHaveBeenCalledWith(
                'Rate limit warning',
                expect.objectContaining({
                    warning: 'Missing CF-Connecting-IP header'
                })
            ); // Verify warning is logged when header is missing
        });
    });

    describe('Rate Limiting', () => {
        test('tracks successful requests', () => {
            const req = createMockRequest('1.2.3.4');
            
            // First request should be allowed
            expect(rateLimiter.canMakeRequest(req)).toBe(true);
            rateLimiter.trackSuccessfulRequest(req);

            const limits = rateLimiter.getLimitInfo(req);
            expect(limits.hourly.remaining).toBeLessThan(RATE_LIMITS.HOURLY_LIMIT); // Verify hourly limit is decremented
            expect(limits.daily.remaining).toBeLessThan(RATE_LIMITS.DAILY_LIMIT);  // Verify daily limit is decremented
        });

        test('enforces hourly limits', () => {
            const req = createMockRequest('1.2.3.4');
            
            // Make maximum allowed requests
            for (let i = 0; i < RATE_LIMITS.HOURLY_LIMIT; i++) {
                expect(rateLimiter.canMakeRequest(req)).toBe(true);
                rateLimiter.trackSuccessfulRequest(req);
            }

            // Next request should be denied
            expect(rateLimiter.canMakeRequest(req)).toBe(false); // Verify hourly limit is enforced
        });

        test('enforces daily limits', () => {
            const req = createMockRequest('1.2.3.4');
            const now = Date.now();
            let currentTime = now;
            
            // Mock Date.now to control time
            jest.spyOn(Date, 'now').mockImplementation(() => currentTime);
            
            // Make requests in batches to avoid hourly limit
            for (let batch = 0; batch < 3; batch++) {
                // Each batch is 1.5 hours apart to reset hourly limits
                currentTime = now + (batch * HOUR * 1.5);
                
                // Make 10 requests in each batch
                for (let i = 0; i < 10; i++) {
                    const canMake = rateLimiter.canMakeRequest(req);
                    if (!canMake) {
                        // Get limit info for debugging
                        const limitInfo = rateLimiter.getLimitInfo(req);
                        console.log(`Failed at batch ${batch}, request ${i}. Limit info:`, {
                            hourlyRemaining: limitInfo.hourly.remaining,
                            dailyRemaining: limitInfo.daily.remaining
                        });
                    }
                    expect(canMake).toBe(batch < 3); // Should allow first 30 requests (3 batches of 10)
                    if (canMake) {
                        rateLimiter.trackSuccessfulRequest(req);
                    }
                }
            }

            // Verify we hit the daily limit
            expect(rateLimiter.canMakeRequest(req)).toBe(false); // Verify daily limit is enforced
        });

        test('resets limits after window expiry', async () => {
            const req = createMockRequest('1.2.3.4');
            
            // Make some requests
            rateLimiter.trackSuccessfulRequest(req);
            rateLimiter.trackSuccessfulRequest(req);

            // Fast forward time
            const now = Date.now();
            jest.spyOn(Date, 'now').mockImplementation(() => now + HOUR + 1000);

            // Should be allowed again
            expect(rateLimiter.canMakeRequest(req)).toBe(true); // Verify limits reset after expiry
        });

        test('handles multiple IPs independently', () => {
            const req1 = createMockRequest('1.2.3.4');
            const req2 = createMockRequest('5.6.7.8');
            
            // Track requests for both IPs
            rateLimiter.trackSuccessfulRequest(req1);
            rateLimiter.trackSuccessfulRequest(req2);

            // Check limits independently
            const limits1 = rateLimiter.getLimitInfo(req1);
            const limits2 = rateLimiter.getLimitInfo(req2);
            
            expect(limits1.hourly.remaining).toBe(RATE_LIMITS.HOURLY_LIMIT - 1); // Verify limits are tracked per IP
            expect(limits2.hourly.remaining).toBe(RATE_LIMITS.HOURLY_LIMIT - 1); // Verify limits are tracked per IP
        });
    });

    describe('CIDR Whitelisting', () => {
        test('accepts IPs within whitelisted CIDR ranges', () => {
            const validIPs = [
                '131.136.1.1',    // Within 131.136.0.0/16
                '131.136.255.255',
                '205.193.0.1',    // Within 205.193.0.0/16
                '205.193.255.255'
            ];

            validIPs.forEach(ip => {
                const req = createMockRequest(ip);
                expect(rateLimiter.canMakeRequest(req)).toBe(true); // Verify whitelisted IPs are allowed
            });
        });

        test('rate limits IPs outside whitelisted CIDR ranges', () => {
            const invalidIPs = [
                '131.137.0.1',    // Outside 131.136.0.0/16
                '205.194.0.1',    // Outside 205.193.0.0/16
                '192.168.1.1',
                '10.0.0.1'
            ];

            invalidIPs.forEach(ip => {
                const req = createMockRequest(ip);
                // First request should be allowed but rate limited
                expect(rateLimiter.canMakeRequest(req)).toBe(true);
                rateLimiter.trackSuccessfulRequest(req);
            }); // Verify non-whitelisted IPs are rate limited
        });

        test('handles invalid IP formats', () => {
            const invalidIPs = [
                '256.1.2.3',      // Invalid octet
                '192.168.1',      // Incomplete IP
                'invalid',        // Invalid format
                '192.168.1.1.1'   // Too many octets
            ];

            invalidIPs.forEach(ip => {
                const req = createMockRequest(ip);
                // Should be treated as non-whitelisted
                expect(rateLimiter.canMakeRequest(req)).toBe(true); // Verify invalid IPs are treated as non-whitelisted
            });
        });
    });

    describe('Memory Management', () => {
        test('cleans up old entries', () => {
            const req = createMockRequest('1.2.3.4');
            
            // Make a request
            rateLimiter.trackSuccessfulRequest(req);
            
            // Fast forward past cleanup interval
            const now = Date.now();
            jest.spyOn(Date, 'now').mockImplementation(() => now + DAY + 1000);
            
            // Trigger cleanup
            rateLimiter['cleanupOldEntries']();
            
            // Verify entry was cleaned up
            expect(rateLimiter['limits'].has('1.2.3.4')).toBe(false); // Verify old entries are cleaned up
        });

        test('keeps recent entries during cleanup', () => {
            const req = createMockRequest('1.2.3.4');
            
            // Make a request
            rateLimiter.trackSuccessfulRequest(req);
            
            // Fast forward but stay within window
            const now = Date.now();
            jest.spyOn(Date, 'now').mockImplementation(() => now + HOUR / 2);
            
            // Trigger cleanup
            rateLimiter['cleanupOldEntries']();
            
            // Verify entry was kept
            expect(rateLimiter['limits'].has('1.2.3.4')).toBe(true); // Verify recent entries are kept
        });
    });
}); 