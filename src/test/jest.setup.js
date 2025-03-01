/**
 * Jest setup configuration
 * 
 * This file contains setup code that runs before the tests
 * Prioritizes real .env variables and uses minimal mocking
 */

/* eslint-env node */
/* eslint-disable @typescript-eslint/no-require-imports */
const { jest } = require('@jest/globals');
const dotenv = require('dotenv');

// Load environment variables from .env file
// This loads variables before any tests run
dotenv.config();

// Set fallback values ONLY if environment variables are not defined
// This preserves real .env values when available
if (!process.env.PORT) process.env.PORT = '3000';
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'test';
if (!process.env.LLM_API_KEY) process.env.LLM_API_KEY = 'test_key';
if (!process.env.PACE_NOTE_MODEL) process.env.PACE_NOTE_MODEL = 'test_model';
if (!process.env.DOAD_FINDER_MODEL) process.env.DOAD_FINDER_MODEL = 'test_model';
if (!process.env.DOAD_CHAT_MODEL) process.env.DOAD_CHAT_MODEL = 'test_model';
if (!process.env.S3_BUCKET_NAME) process.env.S3_BUCKET_NAME = 'test_bucket';
if (!process.env.S3_ACCESS_KEY) process.env.S3_ACCESS_KEY = 'test_access_key';
if (!process.env.S3_SECRET_KEY) process.env.S3_SECRET_KEY = 'test_secret_key';

// Helper to determine if we should use real services or mocks
globalThis.shouldUseMocks = {
  // Check if specific services should use real connections or mocks
  llm: !process.env.USE_REAL_LLM_API && process.env.NODE_ENV === 'test',
  s3: !process.env.USE_REAL_S3 && process.env.NODE_ENV === 'test',
  
  // Helper to determine if specific credentials are properly configured
  hasS3Credentials: () => 
    process.env.S3_BUCKET_NAME && 
    process.env.S3_ACCESS_KEY && 
    process.env.S3_SECRET_KEY,
  
  hasLLMCredentials: () => 
    process.env.LLM_API_KEY &&
    process.env.PACE_NOTE_MODEL && 
    process.env.DOAD_FINDER_MODEL && 
    process.env.DOAD_CHAT_MODEL
};

// Only mock fetch if we're not using real services
// This allows tests to conditionally use real API calls when appropriate
if (globalThis.shouldUseMocks.llm) {
  globalThis.fetch = jest.fn(() => 
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: 'Test response' } }],
        model: 'test-model',
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
      }),
      text: () => Promise.resolve(''),
    })
  );
}

// Silent console during tests unless explicitly enabled
if (!process.env.VERBOSE_TESTS) {
  /* global console */
  globalThis.console = {
    ...console,
    debug: jest.fn(),
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
} 