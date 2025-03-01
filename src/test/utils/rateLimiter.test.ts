/**
 * Rate limiter tests
 * Tests configurable rate limiting with minimal mocking
 */

import { describe, expect, test } from '@jest/globals';
import { rateLimiter } from '../../server/utils/rateLimiter';
import { IncomingMessage as IncomingMessageClass } from 'http';

// Create a mock IncomingMessage with headers
class MockIncomingMessage extends IncomingMessageClass {
  constructor(public headers: Record<string, string> = {}) {
    super({} as unknown);
  }
}

describe('Rate Limiter Module', () => {
  test('rateLimiter instance is defined', () => {
    expect(rateLimiter).toBeDefined();
    expect(typeof rateLimiter.canMakeRequest).toBe('function');
    expect(typeof rateLimiter.trackSuccessfulRequest).toBe('function');
    expect(typeof rateLimiter.getLimitInfo).toBe('function');
  });

  test('allows requests with valid headers', () => {
    const req = new MockIncomingMessage({
      'cf-connecting-ip': '192.168.1.1'
    });
    
    expect(rateLimiter.canMakeRequest(req)).toBe(true);
  });

  test('tracks successful requests correctly', () => {
    const req = new MockIncomingMessage({
      'cf-connecting-ip': '192.168.1.2'
    });
    
    // First request should be allowed
    const canMakeFirst = rateLimiter.canMakeRequest(req);
    expect(canMakeFirst).toBe(true);
    
    // Track the request
    rateLimiter.trackSuccessfulRequest(req);
    
    // Check limit info
    const limitInfo = rateLimiter.getLimitInfo(req);
    expect(limitInfo).toBeDefined();
    expect(limitInfo.hourly).toHaveProperty('remaining');
    expect(limitInfo.daily).toHaveProperty('remaining');
  });

  test('returns correct limit information', () => {
    const req = new MockIncomingMessage({
      'cf-connecting-ip': '192.168.1.3'
    });
    
    const limitInfo = rateLimiter.getLimitInfo(req);
    
    expect(limitInfo).toBeDefined();
    expect(limitInfo.hourly).toHaveProperty('remaining');
    expect(limitInfo.hourly).toHaveProperty('resetIn');
    expect(limitInfo.daily).toHaveProperty('remaining');
    expect(limitInfo.daily).toHaveProperty('resetIn');
  });
}); 