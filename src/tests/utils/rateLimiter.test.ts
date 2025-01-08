import { rateLimiter } from '../../server/utils/rateLimiter';
import { IncomingMessage } from 'http';
import { RATE_LIMITS } from '../../server/utils/config';

// Add constants needed for tests
const HOUR = 60 * 60 * 1000;  // 1 hour in milliseconds
const DAY = 24 * HOUR;        // 1 day in milliseconds

describe('RateLimiter', () => {
  beforeEach(() => {
    // Reset rateLimiter maps before each test
    rateLimiter['limits'].clear();
    rateLimiter['ipv6Limits'].clear();
  });

  afterEach(() => {
    // Stop the cleanup interval
    rateLimiter.stopCleanup();
    jest.restoreAllMocks();
  });

  // Helper to create mock request with IP
  const createMockRequest = (ip: string): IncomingMessage => {
    return {
      socket: {
        remoteAddress: ip
      }
    } as IncomingMessage;
  };

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
        // Should not be whitelisted
        const result = rateLimiter.canMakeRequest(req);
        // First request should be allowed even though not whitelisted
        expect(result).toBe(true);
      });
    });

    test('handles edge cases', () => {
      // Test invalid IP formats
      const invalidIPs = [
        '256.1.2.3',      // Invalid octet
        '192.168.1',      // Incomplete IP
        'invalid',        // Invalid format
        '192.168.1.1.1'   // Too many octets
      ];

      invalidIPs.forEach(ip => {
        const req = createMockRequest(ip);
        // Should default to '0.0.0.0' and not be whitelisted
        expect(rateLimiter.canMakeRequest(req)).toBe(true);
      });
    });

    test('handles IPv6 addresses correctly', () => {
      const ipv6Addresses = [
        '2001:db8::1',
        '::1',
        '::ffff:192.168.1.1'  // IPv4-mapped IPv6
      ];

      ipv6Addresses.forEach(ip => {
        const req = createMockRequest(ip);
        // First request should be allowed but not whitelisted
        expect(rateLimiter.canMakeRequest(req)).toBe(true);
      });
    });
  });

  describe('Rate Limiting', () => {
    test('tracks successful requests', () => {
      const ip = '192.168.1.1';
      const req = createMockRequest(ip);
      
      // First request should be allowed
      expect(rateLimiter.canMakeRequest(req)).toBe(true);
      rateLimiter.trackSuccessfulRequest(req);

      const limits = rateLimiter.getLimitInfo(ip);
      expect(limits.hourly.remaining).toBeLessThan(RATE_LIMITS.HOURLY_LIMIT);
      expect(limits.daily.remaining).toBeLessThan(RATE_LIMITS.DAILY_LIMIT);
    });

    test('respects rate limits', () => {
      const ip = '192.168.1.2';
      const req = createMockRequest(ip);
      
      // Make max hourly requests
      for (let i = 0; i < RATE_LIMITS.HOURLY_LIMIT; i++) {
        expect(rateLimiter.canMakeRequest(req)).toBe(true);
        rateLimiter.trackSuccessfulRequest(req);
      }

      // Next request should be denied
      expect(rateLimiter.canMakeRequest(req)).toBe(false);
    });

    test('resets windows after expiry', async () => {
      const ip = '192.168.1.3';
      const req = createMockRequest(ip);
      
      // Make some requests
      rateLimiter.trackSuccessfulRequest(req);
      rateLimiter.trackSuccessfulRequest(req);

      // Fast forward time
      const now = Date.now();
      jest.spyOn(Date, 'now').mockImplementation(() => now + HOUR + 1000);

      // Should be allowed again
      expect(rateLimiter.canMakeRequest(req)).toBe(true);
      
      // Cleanup
      jest.restoreAllMocks();
    });
  });

  describe('Memory Management', () => {
    test('cleans up old entries', () => {
      const ip = '192.168.1.4';
      const req = createMockRequest(ip);
      
      // Make a request
      rateLimiter.trackSuccessfulRequest(req);
      
      // Fast forward past cleanup interval
      const now = Date.now();
      jest.spyOn(Date, 'now').mockImplementation(() => now + DAY + 1000);
      
      // Trigger cleanup
      rateLimiter['cleanupOldEntries']();
      
      // Verify entry was cleaned up
      expect(rateLimiter['limits'].has(ip)).toBe(false);
    });
  });
}); 