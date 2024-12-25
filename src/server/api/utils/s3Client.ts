import { S3Client } from "@aws-sdk/client-s3";
import { CONFIG } from "../../config";
import { logger } from "../../logger";

logger.debug('Initializing S3 client with config:', {
    endpoint: CONFIG.s3.endpoint,
    bucket: CONFIG.s3.bucketName,
    forcePathStyle: true
});

// Initialize S3 client with read-only access
export const s3Client = new S3Client({
    endpoint: CONFIG.s3.endpoint,
    region: 'auto',
    credentials: {
        accessKeyId: CONFIG.s3.accessKeyId,
        secretAccessKey: CONFIG.s3.secretAccessKey,
    },
    forcePathStyle: true // Required for Storj compatibility
});

logger.info('S3 client initialized successfully'); 