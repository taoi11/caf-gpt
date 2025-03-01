/**
 * Centralized configuration manager for environment variables and application constants.
 * Validates required environment settings on startup and provides typed access to
 * model configurations, rate limiting parameters, and time constants.
 */
import 'dotenv/config';
const env = process.env;

// Validate required environment variables
const required = [
    'PORT',
    'LLM_API_KEY',
    'PACE_NOTE_MODEL',
    'DOAD_FINDER_MODEL',
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
export const IS_DEV = env.NODE_ENV !== 'production';
export const PORT = parseInt(env.PORT || '3000', 10);

// Export model configurations
export const MODELS = {
    doad: {
        finder: env.DOAD_FINDER_MODEL,
        chat: env.DOAD_CHAT_MODEL
    },
    paceNote: env.PACE_NOTE_MODEL
} as const;

// Time constants in milliseconds
export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

// Rate limiting configuration
export const RATE_LIMITS = {
    WHITELISTED_CIDRS: [
        '205.193.0.0/16',  // DND network range only
    ],
    HOURLY_LIMIT: 10,    // 10 requests per hour
    DAILY_LIMIT: 30,     // 30 requests per day
    CLEANUP_INTERVAL: HOUR,
    MAX_IPS: 10000,      // Maximum number of IPs to track
    MAX_TIMESTAMPS_PER_WINDOW: 100,  // Maximum number of timestamps to store per window
    // Time windows
    HOUR,
    DAY
} as const; 
