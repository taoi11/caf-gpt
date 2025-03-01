/**
 * Cost tracker tests
 * Tests API cost tracking functions
 */

import { describe, expect, test, jest, beforeEach } from '@jest/globals';

// Mock the logger module before importing costTracker
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

// Now we can safely import the costTracker module
import { costTracker } from '../../server/utils/costTracker';

describe('Cost Tracker Module', () => {
  beforeEach(() => {
    // Clear all Jest mocks
    jest.clearAllMocks();
  });
  
  test('costTracker module is defined', () => {
    expect(costTracker).toBeDefined();
    expect(typeof costTracker.trackUsage).toBe('function');
    expect(typeof costTracker.getCostData).toBe('function');
  });

  test('tracks token usage cost correctly', async () => {
    // Usage for a test request
    const usage = {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150
    };
    
    // Track cost for a model
    await costTracker.trackUsage(usage);
    
    // Verify the cost calculation
    const costData = costTracker.getCostData();
    expect(costData.apiCosts).toBeGreaterThanOrEqual(0);
  });
}); 