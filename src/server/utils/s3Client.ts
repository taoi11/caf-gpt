import { S3Client } from '@aws-sdk/client-s3';
import { logger } from './logger';

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