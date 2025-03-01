/**
 * LLM Gateway tests
 * Tests API interaction with LLM provider
 */

import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { llmGateway } from '../../server/utils/llmGateway';
import type { LLMRequest } from '../../server/types';

// Define types for our global shouldUseMocks
declare global {
  let shouldUseMocks: {
    llm: boolean;
    s3: boolean;
    hasS3Credentials: () => boolean;
    hasLLMCredentials: () => boolean;
  };
}

// Use global helper to determine if we should use real LLM
const hasLLMCredentials = global.shouldUseMocks.hasLLMCredentials();
const useRealLLM = !global.shouldUseMocks.llm && hasLLMCredentials;

// Conditional test execution based on credentials
const itif = (condition: boolean) => condition ? test : test.skip;
const realLLMTest = itif(useRealLLM);
const mockLLMTest = itif(!useRealLLM);

describe('LLM Gateway Module', () => {
  beforeEach(() => {
    // Only mock fetch if we're not using real LLM API
    if (!useRealLLM) {
      // Reset fetch mock before each test
      globalThis.fetch = jest.fn(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            choices: [{ message: { content: 'Test response' } }],
            model: 'test-model',
            usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
          })
        })
      ) as unknown as typeof fetch;
    }
  });

  test('llmGateway instance is defined', () => {
    expect(llmGateway).toBeDefined();
    expect(typeof llmGateway.query).toBe('function');
  });

  // Group mock tests
  describe('Mock LLM Tests', () => {
    mockLLMTest('processes LLM requests with mock successfully', async () => {
      const testRequest: LLMRequest = {
        messages: [{ role: 'user', content: 'Test message', timestamp: new Date().toISOString() }],
        temperature: 0.5
      };

      const response = await llmGateway.query(testRequest);
      
      expect(response).toBeDefined();
      expect(response.content).toBe('Test response');
      expect(response.model).toBe('test-model');
      expect(response.usage).toEqual({
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30
      });

      // Verify fetch was called with the right parameters (only for mock tests)
      expect(fetch).toHaveBeenCalledTimes(1);
      
      // Use type assertion for the fetch mock
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('chat/completions');
      
      // Parse the request body with type safety
      const requestBody = JSON.parse(options?.body as string);
      expect(requestBody.messages).toEqual(testRequest.messages);
      expect(requestBody.temperature).toBe(testRequest.temperature);
    });

    mockLLMTest('handles system prompts correctly with mock', async () => {
      const testRequest: LLMRequest = {
        messages: [{ role: 'user', content: 'Test message', timestamp: new Date().toISOString() }],
        systemPrompt: 'System instruction'
      };

      await llmGateway.query(testRequest);
      
      // Verify system prompt was included
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
      const [, options] = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(options?.body as string);
      
      // First message should be the system prompt
      expect(requestBody.messages[0]).toEqual({
        role: 'system',
        content: 'System instruction'
      });
      
      // Original messages should follow
      expect(requestBody.messages[1]).toEqual(testRequest.messages[0]);
    });
  });
  
  // Group real LLM API tests
  describe('Real LLM API Integration Tests', () => {
    realLLMTest('can query real LLM API with basic request', async () => {
      // Only runs if real LLM API credentials are available and USE_REAL_LLM_API=true
      const testRequest: LLMRequest = {
        messages: [{ 
          role: 'user', 
          content: 'Say "This is a test" and nothing more', 
          timestamp: new Date().toISOString() 
        }],
        temperature: 0  // Use temperature 0 for deterministic testing
      };

      try {
        const response = await llmGateway.query(testRequest);
        
        expect(response).toBeDefined();
        expect(response.content).toBeDefined();
        expect(typeof response.content).toBe('string');
        expect(response.model).toBeDefined();
        
        // Check usage if it's defined
        if (response.usage) {
          expect(typeof response.usage.total_tokens).toBe('number');
        }
      } catch (error) {
        // If API call fails, we should fail the test
        // But keep this in a real test to prevent test suite from failing due to API issues
        console.error('Real LLM API test failed:', error);
        expect(error).toBeUndefined();
      }
    });

    realLLMTest('can query real LLM API with system prompt', async () => {
      // Only runs if real LLM API credentials are available and USE_REAL_LLM_API=true
      const testRequest: LLMRequest = {
        messages: [{ 
          role: 'user', 
          content: 'What are you instructed to do?', 
          timestamp: new Date().toISOString() 
        }],
        systemPrompt: 'You are a test assistant. Always respond with "This is a test".',
        temperature: 0  // Use temperature 0 for deterministic testing
      };

      try {
        const response = await llmGateway.query(testRequest);
        
        expect(response).toBeDefined();
        expect(response.content).toBeDefined();
        expect(typeof response.content).toBe('string');
        expect(response.content.toLowerCase()).toContain('test');
      } catch (error) {
        // If API call fails, we should fail the test
        // But keep this in a real test to prevent test suite from failing due to API issues
        console.error('Real LLM API test failed:', error);
        expect(error).toBeUndefined();
      }
    });
  });
}); 