/**
 * LLM Gateway tests
 * Tests API interaction with LLM provider
 */

import { describe, expect, test, jest, beforeEach } from '@jest/globals';

// Mock the logger module before importing llmGateway
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

// Create a proper typed mock for fetch
const mockFetch = jest.fn() as jest.MockedFunction<typeof global.fetch>;
// Replace global fetch with our mock
global.fetch = mockFetch;

// Now we can safely import the llmGateway module
import { llmGateway } from '../../server/utils/llmGateway';

describe('LLM Gateway Module', () => {
  beforeEach(() => {
    // Clear all Jest mocks
    jest.clearAllMocks();
    
    // Reset the fetch mock
    mockFetch.mockReset();
  });
  
  test('llmGateway instance is defined', () => {
    expect(llmGateway).toBeDefined();
    expect(typeof llmGateway.query).toBe('function');
    expect(typeof llmGateway.validateApiKey).toBe('function');
  });

  test('validates API key correctly with valid key', async () => {
    // Mock a successful API key validation response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ valid: true })
    } as Response);
    
    const apiKey = 'valid_test_key';
    const result = await llmGateway.validateApiKey(apiKey);
    
    // Verify the fetch was called with correct parameters
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/auth/key',
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );
    
    // Check the result
    expect(result).toBe(true);
  });
  
  test('validates API key correctly with invalid key', async () => {
    // Mock a failed API key validation response
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid API key' })
    } as Response);
    
    const apiKey = 'invalid_test_key';
    const result = await llmGateway.validateApiKey(apiKey);
    
    // Verify the fetch was called with correct parameters
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/auth/key',
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );
    
    // Check the result
    expect(result).toBe(false);
  });
  
  test('handles API key validation errors gracefully', async () => {
    // Mock a fetch error
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    
    const apiKey = 'test_key';
    const result = await llmGateway.validateApiKey(apiKey);
    
    // Verify the fetch was called
    expect(mockFetch).toHaveBeenCalledTimes(1);
    
    // Should return false on error
    expect(result).toBe(false);
  });
}); 