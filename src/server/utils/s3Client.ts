/**
 * S3 storage client for managing policy document storage and retrieval.
 * Provides a simple interface for fetching documents from cloud storage
 * with proper error handling and logging to support policy access.
 */
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { logger } from './logger';
import type { PolicyDocument } from '../types';

// S3 configuration
const s3Config = {
    endpoint: process.env.S3_ENDPOINT || 'https://gateway.storjshare.io',
    region: process.env.S3_REGION || 'us-1',
    forcePathStyle: true,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || '',
        secretAccessKey: process.env.S3_SECRET_KEY || ''
    }
};
// Initialize S3 client
logger.debug('Initializing S3 client with config:', {
    endpoint: s3Config.endpoint,
    bucket: process.env.S3_BUCKET || 'policies',
    forcePathStyle: true
});
export const s3Client = new S3Client(s3Config);

// S3 utility functions
export const s3Utils = {
    // Fetches a policy document from S3
    async fetchDocument(docId: string, group: string = 'doad'): Promise<PolicyDocument> {
        try {
            const key = `${group}/${docId}.md`;
            logger.debug(`Fetching document: ${key}`);
            // Fetch document from S3
            const response = await s3Client.send(new GetObjectCommand({
                Bucket: process.env.S3_BUCKET || 'policies',
                Key: key,
            }));
            // Get content from response
            const content = await response.Body?.transformToString();
            // Check if content is empty
            if (!content) {
                logger.error(`Empty content received for document ${key}`);
                throw new Error(`Empty content for document ${docId}`);
            }
            // Log success
            logger.debug(`Successfully fetched document ${key}`);
            // Return document
            return {
                docId,
                content,
                lastModified: response.LastModified || new Date(),
                policyGroup: group
            };
        } catch (error) {
            logger.error('Failed to fetch document', {
                docId,
                group,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    },
    // Fetches raw content from S3
    async fetchRawContent(path: string): Promise<string> {
        try {
            logger.debug(`Fetching raw content from path: ${path}`);
            // Fetch content from S3
            const response = await s3Client.send(new GetObjectCommand({
                Bucket: process.env.S3_BUCKET || 'policies',
                Key: path
            }));
            // Get content from response
            const content = await response.Body?.transformToString() || '';
            // Check if content is empty
            if (!content) {
                logger.warn(`Empty content received for path ${path}`);
            }
            // Return content
            return content;
        } catch (error) {
            logger.error('Failed to get content', {
                path,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
};
