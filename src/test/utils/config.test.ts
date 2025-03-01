/**
 * Configuration tests
 * Tests environment variable and configuration handling
 */

import { describe, expect, test } from '@jest/globals';
import * as config from '../../server/utils/config';

describe('Configuration Module', () => {
  test('exports environment values correctly', () => {
    expect(config.PORT).toBe(3000);
    expect(config.IS_DEV).toBe(true);
  });

  test('exports model configurations correctly', () => {
    expect(config.MODELS).toHaveProperty('doad');
    expect(config.MODELS.doad).toHaveProperty('finder');
    expect(config.MODELS.doad).toHaveProperty('chat');
    expect(config.MODELS).toHaveProperty('paceNote');
  });

  test('exports rate limiting configuration correctly', () => {
    expect(config.RATE_LIMITS).toHaveProperty('HOURLY_LIMIT');
    expect(config.RATE_LIMITS).toHaveProperty('DAILY_LIMIT');
    expect(config.RATE_LIMITS).toHaveProperty('WHITELISTED_CIDRS');
    expect(Array.isArray(config.RATE_LIMITS.WHITELISTED_CIDRS)).toBe(true);
  });
}); 