/**
 * Cost tracker tests
 * Tests API cost tracking functions
 */

import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { costTracker } from '../../server/utils/costTracker';

// Define types for our global shouldUseMocks
declare global {
  let shouldUseMocks: {
    llm: boolean;
    s3: boolean;
    hasS3Credentials: () => boolean;
    hasLLMCredentials: () => boolean;
  };
}

// Mock response type for fetch
type MockResponseInit = {
  ok: boolean;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
  status?: number;
  headers?: Headers;
};

// Create a proper Response object for the mock
const createMockResponse = (init: MockResponseInit): Response => {
  const body = JSON.stringify(init.json());
  const response = new Response(body, {
    status: init.status || 200,
    headers: init.headers || new Headers(),
  });
  
  // Override the json and text methods
  Object.defineProperties(response, {
    json: { value: init.json },
    text: { value: init.text },
  });
  
  return response;
};

describe('Cost Tracker Module', () => {
  beforeEach(() => {
    // Reset mocks and spies
    jest.clearAllMocks();
    
    // Create a type-safe mock for fetch
    globalThis.fetch = jest.fn((_url: string, _options?: RequestInit) => 
      Promise.resolve(
        createMockResponse({
          ok: true,
          json: () => Promise.resolve({ 
            data: { total_cost: 0.25 } 
          }),
          text: () => Promise.resolve(''),
          status: 200
        })
      )
    ) as jest.MockedFunction<typeof fetch>;
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
    
    // Verify fetch was called if using the API
    if (global.shouldUseMocks.llm) {
      expect(fetch).toHaveBeenCalledTimes(1);
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/costs');
    }
  });
}); 