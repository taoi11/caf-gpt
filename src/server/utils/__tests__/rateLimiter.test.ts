import { IncomingMessage } from 'http';
import { rateLimiter } from '../rateLimiter';
import { RATE_LIMITS, HOUR } from '../config';

describe('RateLimiter', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    const mockRequest = (headers: Record<string, string | string[] | undefined> = {}): IncomingMessage => {
        return {
            headers,
            socket: {
                remoteAddress: '192.168.1.1'
            }
        } as unknown as IncomingMessage;
    };

    describe('IP Resolution', () => {
        it('should use CF-Connecting-IP header in production', () => {
            process.env.NODE_ENV = 'production';
            const req = mockRequest({
                'cf-connecting-ip': '1.2.3.4',
                'cf-ray': 'ray-id'
            });
            expect(rateLimiter.getIP(req)).toBe('1.2.3.4');
            process.env.NODE_ENV = 'development';
        });

        it('should fallback to socket address in development when CF headers missing', () => {
            const req = mockRequest();
            expect(rateLimiter.getIP(req)).toBe('192.168.1.1');
        });

        it('should normalize IPv4-mapped IPv6 addresses', () => {
            const req = mockRequest({
                'cf-connecting-ip': '::ffff:192.168.1.1'
            });
            expect(rateLimiter.getIP(req)).toBe('192.168.1.1');
        });
    });

    describe('Rate Limiting', () => {
        it('should track requests within hourly limit', () => {
            const req = mockRequest({ 'cf-connecting-ip': '1.2.3.4' });
            
            // Make requests up to the hourly limit
            for (let i = 0; i < RATE_LIMITS.HOURLY_LIMIT; i++) {
                expect(rateLimiter.canMakeRequest(req)).toBe(true);
                rateLimiter.trackSuccessfulRequest(req);
            }

            // Next request should be blocked
            expect(rateLimiter.canMakeRequest(req)).toBe(false);
        });

        it('should reset counters after time window expires', () => {
            const req = mockRequest({ 'cf-connecting-ip': '1.2.3.4' });
            
            // Use up the limit
            for (let i = 0; i < RATE_LIMITS.HOURLY_LIMIT; i++) {
                rateLimiter.trackSuccessfulRequest(req);
            }
            expect(rateLimiter.canMakeRequest(req)).toBe(false);

            // Advance time past the window
            jest.advanceTimersByTime(RATE_LIMITS.HOUR + 1000);
            
            // Should be able to make requests again
            expect(rateLimiter.canMakeRequest(req)).toBe(true);
        });

        it('should handle multiple IPs independently', () => {
            const req1 = mockRequest({ 'cf-connecting-ip': '1.2.3.4' });
            const req2 = mockRequest({ 'cf-connecting-ip': '5.6.7.8' });

            // Use up limit for first IP
            for (let i = 0; i < RATE_LIMITS.HOURLY_LIMIT; i++) {
                rateLimiter.trackSuccessfulRequest(req1);
            }

            // First IP should be blocked
            expect(rateLimiter.canMakeRequest(req1)).toBe(false);
            // Second IP should still be allowed
            expect(rateLimiter.canMakeRequest(req2)).toBe(true);
        });
    });

    describe('Cleanup', () => {
        it('should cleanup old entries', () => {
            const req = mockRequest({ 'cf-connecting-ip': '1.2.3.4' });
            rateLimiter.trackSuccessfulRequest(req);

            // Advance time past cleanup interval
            jest.advanceTimersByTime(RATE_LIMITS.CLEANUP_INTERVAL + 1000);

            // Internal cleanup should have run
            expect(rateLimiter.canMakeRequest(req)).toBe(true);
        });
    });
}); 