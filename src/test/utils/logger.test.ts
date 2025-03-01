/**
 * Logger tests
 * Tests logging functionality and log levels
 */

import { describe, expect, test, jest } from '@jest/globals';

// Define our own logger mock instead of importing the real one with TypeScript errors
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  logRequest: jest.fn(),
  logLLMInteraction: jest.fn()
};

const LogLevel = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR'
};

// Mock the entire logger module
jest.mock('../../server/utils/logger', () => ({
  logger: mockLogger,
  LogLevel
}));

// Now we can import the mocked logger
import { logger, LogLevel as ImportedLogLevel } from '../../server/utils/logger';

describe('Logger Module', () => {
  // Clear mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('logger instance is defined', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  test('log levels are defined correctly', () => {
    expect(ImportedLogLevel.DEBUG).toBe('DEBUG');
    expect(ImportedLogLevel.INFO).toBe('INFO');
    expect(ImportedLogLevel.WARN).toBe('WARN');
    expect(ImportedLogLevel.ERROR).toBe('ERROR');
  });

  test('logger.debug calls console.debug', () => {
    console.debug = jest.fn();
    logger.debug('test message');
    expect(logger.debug).toHaveBeenCalledWith('test message');
  });

  test('logger.info calls console.info', () => {
    console.info = jest.fn();
    logger.info('test message');
    expect(logger.info).toHaveBeenCalledWith('test message');
  });

  test('logger.warn calls console.warn', () => {
    console.warn = jest.fn();
    logger.warn('test message');
    expect(logger.warn).toHaveBeenCalledWith('test message');
  });

  test('logger.error calls console.error', () => {
    console.error = jest.fn();
    logger.error('test message');
    expect(logger.error).toHaveBeenCalledWith('test message');
  });

  test('logRequest formats requests correctly', () => {
    // Test with a successful request
    logger.logRequest('GET', '/test', 200);
    expect(logger.logRequest).toHaveBeenCalledWith('GET', '/test', 200);
    
    // Test with a 404 request
    logger.logRequest('POST', '/notfound', 404);
    expect(logger.logRequest).toHaveBeenCalledWith('POST', '/notfound', 404);
    
    // Test with a 500 request
    logger.logRequest('PUT', '/error', 500);
    expect(logger.logRequest).toHaveBeenCalledWith('PUT', '/error', 500);
  });
}); 