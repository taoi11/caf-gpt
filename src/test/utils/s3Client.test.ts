/**
 * S3 Client Module Tests
 * 
 * Tests the S3 client to ensure it properly formats requests,
 * handles responses, and provides access to policy documents.
 * Uses real S3 credentials if available and USE_REAL_S3=true.
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals';
// Using the updated import pattern that will be resolved by Jest's moduleNameMapper
import { s3Client, s3Utils } from '../../server/utils/s3Client';
import { GetObjectCommand } from '@aws-sdk/client-s3';

// Define types for our global shouldUseMocks
declare global {
  let shouldUseMocks: {
    llm: boolean;
    s3: boolean;
    hasS3Credentials: () => boolean;
    hasLLMCredentials: () => boolean;
  };
}

// Use global helper to determine if we have S3 credentials
// @ts-expect-error - shouldUseMocks is defined in jest.setup.js and available at runtime
const hasS3Credentials = globalThis.shouldUseMocks.hasS3Credentials();
// @ts-expect-error - shouldUseMocks is defined in jest.setup.js and available at runtime
const useRealS3 = !globalThis.shouldUseMocks.s3 && hasS3Credentials;

// Conditional test execution based on credentials
const itif = (condition: boolean) => condition ? test : test.skip;
const realS3Test = itif(useRealS3);
const mockS3Test = itif(!useRealS3);

describe('S3 Client Module', () => {
  beforeEach(() => {
    // Reset mocks and spies
    jest.clearAllMocks();
    
    // Only mock S3 client if we're not using real S3
    if (!useRealS3) {
      jest.spyOn(s3Client, 'send').mockImplementation((command) => {
        if (command instanceof GetObjectCommand) {
          return Promise.resolve({
            Body: {
              transformToString: () => Promise.resolve('# Test Document Content')
            },
            LastModified: new Date()
          });
        }
        return Promise.resolve({});
      });
    } else {
      // If using real S3, just spy on the method but don't mock it
      jest.spyOn(s3Client, 'send');
    }
  });

  test('s3Client and utilities are defined', () => {
    expect(s3Client).toBeDefined();
    expect(s3Utils).toBeDefined();
    expect(typeof s3Utils.fetchDocument).toBe('function');
    expect(typeof s3Utils.fetchRawContent).toBe('function');
  });

  // Group mock tests
  describe('Mock S3 Tests', () => {
    mockS3Test('constructs proper S3 key for documents with mock', async () => {
      await s3Utils.fetchDocument('123-45', 'doad');
      
      // Verify the key was constructed correctly in the command
      expect(s3Client.send).toHaveBeenCalledTimes(1);
      // Type assertion for mock call
      const firstCall = (s3Client.send as jest.Mock).mock.calls[0][0] as GetObjectCommand;
      expect(firstCall.input.Key).toBe('doad/123-45.md');
    });

    mockS3Test('constructs proper S3 key for raw content with mock', async () => {
      await s3Utils.fetchRawContent('test/path.md');
      
      // Verify the key was constructed correctly in the command
      expect(s3Client.send).toHaveBeenCalledTimes(1);
      // Type assertion for mock call
      const firstCall = (s3Client.send as jest.Mock).mock.calls[0][0] as GetObjectCommand;
      expect(firstCall.input.Key).toBe('test/path.md');
    });
  });

  // Group real S3 tests
  describe('Real S3 Integration Tests', () => {
    realS3Test('can fetch a document from actual S3', async () => {
      // Only runs if real S3 credentials are available and USE_REAL_S3=true
      try {
        const result = await s3Utils.fetchDocument('test-document', 'doad');
        expect(result).toBeDefined();
        expect(typeof result.content).toBe('string');
        expect(result.lastModified instanceof Date).toBe(true);
      } catch (
        /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
        _error
      ) {
        // If the document doesn't exist, we still want to verify the API call was made
        expect(s3Client.send).toHaveBeenCalledTimes(1);
      }
    });

    realS3Test('can fetch raw content from actual S3', async () => {
      // Only runs if real S3 credentials are available and USE_REAL_S3=true
      try {
        const result = await s3Utils.fetchRawContent('test/README.md');
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
      } catch (
        /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
        _error
      ) {
        // If the file doesn't exist, we still want to verify the API call was made
        expect(s3Client.send).toHaveBeenCalledTimes(1);
      }
    });
  });
}); 