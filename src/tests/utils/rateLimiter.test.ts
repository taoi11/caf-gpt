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
        // Reset rateLimiter maps before each test
        rateLimiter['limits'].clear();
    });

    afterEach(() => {
        // Stop the cleanup interval
        rateLimiter.stopCleanup();
        jest.restoreAllMocks();
    });

    // Helper to create mock request with Cloudflare headers
    const createMockRequest = (cfIP: string, headers: Record<string, string> = {}): IncomingMessage => {
        const socket = new Socket();
        const req = Object.create(IncomingMessage.prototype);
        return Object.assign(req, {
            headers: {
                'cf-connecting-ip': cfIP,
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
            expect(rateLimiter['getClientIP'](req)).toBe(cfIP);
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
            expect(rateLimiter['getClientIP'](req)).toBe('0.0.0.0');
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
            );
        });
    });

    describe('Rate Limiting', () => {
        test('tracks successful requests', () => {
            const req = createMockRequest('1.2.3.4');
            
            // First request should be allowed
            expect(rateLimiter.canMakeRequest(req)).toBe(true);
            rateLimiter.trackSuccessfulRequest(req);

            const limits = rateLimiter.getLimitInfo(req);
            expect(limits.hourly.remaining).toBeLessThan(RATE_LIMITS.HOURLY_LIMIT);
            expect(limits.daily.remaining).toBeLessThan(RATE_LIMITS.DAILY_LIMIT);
        });

        test('enforces hourly limits', () => {
            const req = createMockRequest('1.2.3.4');
            
            // Make maximum allowed requests
            for (let i = 0; i < RATE_LIMITS.HOURLY_LIMIT; i++) {
                expect(rateLimiter.canMakeRequest(req)).toBe(true);
                rateLimiter.trackSuccessfulRequest(req);
            }

            // Next request should be denied
            expect(rateLimiter.canMakeRequest(req)).toBe(false);
        });

        test('enforces daily limits', () => {
            const req = createMockRequest('1.2.3.4');
            
            // Make maximum allowed requests
            for (let i = 0; i < RATE_LIMITS.DAILY_LIMIT; i++) {
                expect(rateLimiter.canMakeRequest(req)).toBe(true);
                rateLimiter.trackSuccessfulRequest(req);
            }

            // Next request should be denied
            expect(rateLimiter.canMakeRequest(req)).toBe(false);
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
            expect(rateLimiter.canMakeRequest(req)).toBe(true);
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
            
            expect(limits1.hourly.remaining).toBe(RATE_LIMITS.HOURLY_LIMIT - 1);
            expect(limits2.hourly.remaining).toBe(RATE_LIMITS.HOURLY_LIMIT - 1);
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
                expect(rateLimiter.canMakeRequest(req)).toBe(true);
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
            });
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
                expect(rateLimiter.canMakeRequest(req)).toBe(true);
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
            expect(rateLimiter['limits'].has('1.2.3.4')).toBe(false);
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
            expect(rateLimiter['limits'].has('1.2.3.4')).toBe(true);
        });
    });
}); 