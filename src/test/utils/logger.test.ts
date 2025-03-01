/**
 * Logger tests
 * Tests logging functionality and log levels
 */

import { describe, expect, test } from '@jest/globals';
import { logger, LogLevel } from '../../server/utils/logger';

describe('Logger Module', () => {
  test('logger instance is defined', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  test('log levels are defined correctly', () => {
    expect(LogLevel.DEBUG).toBe('DEBUG');
    expect(LogLevel.INFO).toBe('INFO');
    expect(LogLevel.WARN).toBe('WARN');
    expect(LogLevel.ERROR).toBe('ERROR');
  });

  test('logger.debug calls console.debug', () => {
    console.debug = jest.fn();
    logger.debug('test message');
    expect(console.debug).toHaveBeenCalled();
  });

  test('logger.info calls console.info', () => {
    console.info = jest.fn();
    logger.info('test message');
    expect(console.info).toHaveBeenCalled();
  });

  test('logger.warn calls console.warn', () => {
    console.warn = jest.fn();
    logger.warn('test message');
    expect(console.warn).toHaveBeenCalled();
  });

  test('logger.error calls console.error', () => {
    console.error = jest.fn();
    logger.error('test message');
    expect(console.error).toHaveBeenCalled();
  });

  test('logRequest formats requests correctly', () => {
    console.info = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
    
    // Test with a successful request
    logger.logRequest('GET', '/test', 200);
    expect(console.debug).toHaveBeenCalled();
    
    // Test with a 404 request
    logger.logRequest('POST', '/notfound', 404);
    expect(console.warn).toHaveBeenCalled();
    
    // Test with a 500 request
    logger.logRequest('PUT', '/error', 500);
    expect(console.error).toHaveBeenCalled();
  });
}); 