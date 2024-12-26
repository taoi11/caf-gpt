import 'dotenv/config';

// Load and validate environment variables
const env = process.env;

// Validate required environment variables
const required = [
    'PORT',
    'NODE_ENV',
    'CF_ACCOUNT_ID',
    'CF_GATEWAY_ID',
    'CF_GATEWAY_API_KEY',
    'LLM_PROVIDER',
    'LLM_API_KEY',
    'PACE_NOTE_MODEL',
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

// Export AI Gateway base URL
export const AI_GATEWAY_URL = `https://gateway.ai.cloudflare.com/v1/${env.CF_ACCOUNT_ID}/${env.CF_GATEWAY_ID}`; 