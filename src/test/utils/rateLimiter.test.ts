/**
 * Rate limiter tests
 * Tests configurable rate limiting with mocks
 */

import { describe, expect, test, jest, beforeEach, afterAll } from '@jest/globals';
import { IncomingMessage } from 'http';

// Define test constants
const HOURLY_LIMIT = 5;
const DAILY_LIMIT = 10;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Mock the config module before importing rateLimiter
jest.mock('../../server/utils/config', () => {
  // Add proper typing to the imported actual config
  const actualConfig = jest.requireActual('../../server/utils/config') as {
    RATE_LIMITS: {
      HOURLY_LIMIT: number;
      DAILY_LIMIT: number;
      [key: string]: any;
    };
    [key: string]: any;
  };
  
  return {
    ...actualConfig,
    RATE_LIMITS: {
      ...actualConfig.RATE_LIMITS,
      HOURLY_LIMIT,
      DAILY_LIMIT
    }
  };
});

// Mock the logger module before importing rateLimiter
jest.mock('../../server/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    logRequest: jest.fn(),
    logLLMInteraction: jest.fn()
  },
  LogLevel: {
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR'
  }
}));

// Now we can safely import the rateLimiter module
import { rateLimiter } from '../../server/utils/rateLimiter';

// Create a mock request with headers
const mockRequest = (ipAddress = '192.168.1.1'): Partial<IncomingMessage> => {
  // Create a simple mock object with just what we need
  return {
    headers: {
      'cf-connecting-ip': ipAddress
    }
  };
};

describe('Rate Limiter Module', () => {
  beforeEach(() => {
    // Reset the rate limiter state between tests
    // Access the internal maps directly via typecast to reset them
    // This is a test-only approach to reset state
    (rateLimiter as any).limits = new Map();
    
    // Clear all Jest mocks
    jest.clearAllMocks();
  });

  test('rateLimiter instance is defined', () => {
    expect(rateLimiter).toBeDefined();
    expect(typeof rateLimiter.canMakeRequest).toBe('function');
    expect(typeof rateLimiter.trackSuccessfulRequest).toBe('function');
    expect(typeof rateLimiter.getLimitInfo).toBe('function');
  });

  test('allows requests with valid headers', () => {
    const req = mockRequest();
    expect(rateLimiter.canMakeRequest(req as IncomingMessage)).toBe(true);
  });

  test('tracks successful requests correctly', () => {
    const req = mockRequest('192.168.1.2');
    const typedReq = req as IncomingMessage;
    
    // First request should be allowed
    const canMakeFirst = rateLimiter.canMakeRequest(typedReq);
    expect(canMakeFirst).toBe(true);
    
    // Track the request
    rateLimiter.trackSuccessfulRequest(typedReq);
    
    // Check limit info
    const limitInfo = rateLimiter.getLimitInfo(typedReq);
    expect(limitInfo).toBeDefined();
    expect(limitInfo.hourly).toHaveProperty('remaining');
    expect(limitInfo.daily).toHaveProperty('remaining');
    
    // Verify that remaining count decreased
    expect(limitInfo.hourly.remaining).toBe(HOURLY_LIMIT - 1);
    expect(limitInfo.daily.remaining).toBe(DAILY_LIMIT - 1);
  });
  
  test('enforces rate limits after max requests', () => {
    const req = mockRequest('192.168.1.3');
    const typedReq = req as IncomingMessage;
    
    // Make requests up to the limit
    for (let i = 0; i < HOURLY_LIMIT; i++) {
      expect(rateLimiter.canMakeRequest(typedReq)).toBe(true);
      rateLimiter.trackSuccessfulRequest(typedReq);
    }
    
    // Next request should be blocked
    expect(rateLimiter.canMakeRequest(typedReq)).toBe(false);
    
    // Verify through limit info
    const limitInfo = rateLimiter.getLimitInfo(typedReq);
    expect(limitInfo.hourly.remaining).toBe(0);
  });

  // Clean up after all tests complete
  afterAll(() => {
    // Call stopCleanup to clear the interval
    rateLimiter.stopCleanup();
  });
}); 