import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from './s3Client';
import { logger } from './logger';
import type { PolicyDocument } from './types';

class PolicyStorage {
    private readonly bucketName: string;

    constructor() {
        this.bucketName = process.env.S3_BUCKET_NAME || '';
        if (!this.bucketName) {
            throw new Error('S3_BUCKET_NAME environment variable is not set');
        }
    }

    public async fetchPolicy(docId: string, policyGroup: string = 'doad'): Promise<PolicyDocument> {
        try {
            const key = `${policyGroup}/${docId}.md`;
            logger.debug(`Fetching policy document: ${key}`);
            
            const response = await s3Client.send(new GetObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            }));

            const content = await response.Body?.transformToString();
            if (!content) {
                logger.error(`Empty content received for policy ${key}`);
                throw new Error(`Empty content for policy ${docId}`);
            }

            logger.debug(`Successfully fetched policy ${key}`);
            return {
                docId,
                content,
                lastModified: response.LastModified || new Date(),
                policyGroup
            };
        } catch (error) {
            logger.error(`Failed to fetch policy ${docId} from group ${policyGroup}:`, error);
            throw error;
        }
    }
}

// Export singleton instance
export const policyStorage = new PolicyStorage(); 