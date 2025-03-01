import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { logger } from './logger.js';
import type { PolicyDocument } from '../types.js';

const s3Config = {
    endpoint: process.env.S3_ENDPOINT || 'https://gateway.storjshare.io',
    region: process.env.S3_REGION || 'us-1',
    forcePathStyle: true,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || '',
        secretAccessKey: process.env.S3_SECRET_KEY || ''
    }
};

logger.debug('Initializing S3 client with config:', {
    endpoint: s3Config.endpoint,
    bucket: process.env.S3_BUCKET || 'policies',
    forcePathStyle: true
});

export const s3Client = new S3Client(s3Config);

/**
 * S3 client wrapper for policy document storage operations.
 * Provides validated access to policy documents and raw content storage,
 * with integrated error handling and request logging for S3 interactions.
 */
export const s3Utils = {
    /**
     * Retrieves a policy document from S3 storage
     * @param docId - Document identifier (DOAD number)
     * @param group - Policy group/directory (default: 'doad')
     * @returns PolicyDocument with content and metadata
     * @throws Error if document retrieval fails or content is empty
     */
    async fetchDocument(docId: string, group: string = 'doad'): Promise<PolicyDocument> {
        try {
            const key = `${group}/${docId}.md`;
            logger.debug(`Fetching document: ${key}`);
            
            const response = await s3Client.send(new GetObjectCommand({
                Bucket: process.env.S3_BUCKET || 'policies',
                Key: key,
            }));

            const content = await response.Body?.transformToString();
            if (!content) {
                logger.error(`Empty content received for document ${key}`);
                throw new Error(`Empty content for document ${docId}`);
            }

            logger.debug(`Successfully fetched document ${key}`);
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

    /**
     * Fetches raw content from S3 without document validation
     * @param path - Full S3 object path
     * @returns Raw content as string
     */
    async fetchRawContent(path: string): Promise<string> {
        try {
            logger.debug(`Fetching raw content from path: ${path}`);
            
            const response = await s3Client.send(new GetObjectCommand({
                Bucket: process.env.S3_BUCKET || 'policies',
                Key: path
            }));

            const content = await response.Body?.transformToString() || '';
            
            if (!content) {
                logger.warn(`Empty content received for path ${path}`);
            }

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
