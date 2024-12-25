import { S3Client } from "@aws-sdk/client-s3";
import { logger } from "../../logger";

const S3_ENDPOINT = 'https://gateway.storjshare.io';

logger.debug('Initializing S3 client with config:', {
    endpoint: S3_ENDPOINT,
    bucket: process.env.S3_BUCKET_NAME,
    forcePathStyle: true
});

// Initialize S3 client with read-only access
export const s3Client = new S3Client({
    endpoint: S3_ENDPOINT,
    region: 'us-1',
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || '',
        secretAccessKey: process.env.S3_SECRET_KEY || '',
    },
    forcePathStyle: true // Required for Storj compatibility
});

logger.info('S3 client initialized successfully'); 