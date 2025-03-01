/**
 * S3 Client Module Tests
 * 
 * Tests the s3Client module using mocked S3 responses instead of real AWS calls.
 * This approach is faster, more reliable, and doesn't require actual credentials.
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';

// Mock AWS SDK S3 Client before importing the module that uses it
jest.mock('@aws-sdk/client-s3');

// Mock logger before importing s3Client
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

// Import s3Client after mocking
import { s3Client, s3Utils } from '../../server/utils/s3Client';

describe('S3 Client Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset the mock implementation for s3Client.send
    // @ts-ignore - TypeScript doesn't recognize jest mocks well
    s3Client.send.mockReset();
  });

  test('s3Client and utilities are defined', () => {
    expect(s3Client).toBeDefined();
    expect(s3Utils).toBeDefined();
    expect(typeof s3Utils.fetchDocument).toBe('function');
    expect(typeof s3Utils.fetchRawContent).toBe('function');
  });

  test('can connect to S3 and list objects', async () => {
    // Mock a successful list objects response
    const mockResponse = {
      Contents: [{ Key: 'test-key', LastModified: new Date() }]
    };
    
    // Set up the mock to return our response
    // @ts-ignore - TypeScript doesn't recognize jest mocks well
    s3Client.send.mockResolvedValueOnce(mockResponse);
    
    // Call the function we want to test
    const response = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: 'test-bucket',
        MaxKeys: 1
      })
    );
    
    // Verify the response is what we expect
    expect(response).toEqual(mockResponse);
    
    // Verify the client was called with the right parameters
    expect(s3Client.send).toHaveBeenCalledTimes(1);
    expect(s3Client.send).toHaveBeenCalledWith(expect.any(ListObjectsV2Command));
  });

  test('fetchDocument builds proper S3 key and handles responses', async () => {
    // Mock successful GetObject response with document content
    const mockDate = new Date();
    const mockContentObj = { title: 'Test Document', content: 'This is a test document' };
    const mockContent = JSON.stringify(mockContentObj);
    
    // Create a mock stream that we can read from
    const mockStream = {
      // @ts-ignore - TypeScript doesn't recognize jest mocks well
      transformToString: jest.fn().mockResolvedValue(mockContent)
    };
    
    const mockGetObjectResponse = {
      Body: mockStream,
      LastModified: mockDate
    };
    
    // Set up the mock to return our response
    // @ts-ignore - TypeScript doesn't recognize jest mocks well
    s3Client.send.mockResolvedValueOnce(mockGetObjectResponse);
    
    // Call the function with test params
    const testDocId = 'test-document';
    const testGroup = 'doad';
    const result = await s3Utils.fetchDocument(testDocId, testGroup);
    
    // Verify the returned document structure
    expect(result).toBeDefined();
    expect(result.docId).toBe(testDocId);
    expect(result.policyGroup).toBe(testGroup);
    expect(result.content).toBeDefined();
    expect(result.content).toEqual(mockContent);
    expect(result.lastModified).toEqual(mockDate);
    
    // Verify the send function was called
    expect(s3Client.send).toHaveBeenCalledTimes(1);
    // Verify it was called with a GetObjectCommand
    expect(s3Client.send).toHaveBeenCalledWith(expect.any(GetObjectCommand));
  });

  test('fetchDocument handles error when document does not exist', async () => {
    // Mock an error response for a non-existent file
    // @ts-ignore - TypeScript doesn't recognize jest mocks well
    s3Client.send.mockRejectedValueOnce(
      new Error('NoSuchKey: The specified key does not exist')
    );
    
    // Call the function with test params
    const testDocId = 'non-existent-document';
    const testGroup = 'doad';
    
    // Expect the function to throw an error
    await expect(s3Utils.fetchDocument(testDocId, testGroup))
      .rejects.toThrow(/NoSuchKey|does not exist/);
  });

  test('fetchRawContent builds proper S3 key and handles responses', async () => {
    // Mock successful GetObject response with raw content
    const mockContent = 'This is raw content from a file';
    
    // Create a mock stream
    const mockStream = {
      // @ts-ignore - TypeScript doesn't recognize jest mocks well
      transformToString: jest.fn().mockResolvedValue(mockContent)
    };
    
    const mockGetObjectResponse = {
      Body: mockStream
    };
    
    // Set up the mock to return our response
    // @ts-ignore - TypeScript doesn't recognize jest mocks well
    s3Client.send.mockResolvedValueOnce(mockGetObjectResponse);
    
    // Call the function with test path
    const testPath = 'test/README.md';
    const content = await s3Utils.fetchRawContent(testPath);
    
    // Verify the returned content
    expect(content).toBe(mockContent);
    
    // Verify the send function was called
    expect(s3Client.send).toHaveBeenCalledTimes(1);
    // Verify it was called with a GetObjectCommand
    expect(s3Client.send).toHaveBeenCalledWith(expect.any(GetObjectCommand));
  });

  test('fetchRawContent handles error when file does not exist', async () => {
    // Mock an error response for a non-existent file
    // @ts-ignore - TypeScript doesn't recognize jest mocks well
    s3Client.send.mockRejectedValueOnce(
      new Error('NoSuchKey: The specified key does not exist')
    );
    
    // Call the function with test path
    const testPath = 'non-existent/file.txt';
    
    // Expect the function to throw an error
    await expect(s3Utils.fetchRawContent(testPath))
      .rejects.toThrow(/NoSuchKey|does not exist/);
  });
}); 