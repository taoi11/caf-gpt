import 'dotenv/config';

// Load and validate environment variables
const env = process.env;

// Validate required environment variables
const required = [
    'PORT',
    'NODE_ENV',
    'LLM_API_KEY',
    'PACE_NOTE_MODEL',
    'DOAD_FINDER_MODEL',
    'DOAD_READER_MODEL',
    'DOAD_CHAT_MODEL',
    'S3_BUCKET_NAME',
    'S3_ACCESS_KEY',
    'S3_SECRET_KEY'
];

for (const key of required) {
    if (!env[key]) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
}

// Export environment helpers
export const IS_DEV = (env.NODE_ENV || 'development') === 'development';
export const PORT = parseInt(env.PORT || '3000', 10);

// Export model configurations
export const MODELS = {
    doad: {
        finder: env.DOAD_FINDER_MODEL,
        reader: env.DOAD_READER_MODEL,
        chat: env.DOAD_CHAT_MODEL
    }
} as const; 