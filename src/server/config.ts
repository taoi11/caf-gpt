import { config } from 'dotenv';
import type { AppConfig } from '../types';

// Only load .env file in development
if (process.env.NODE_ENV !== 'production') {
    config();
}

// Helper function to get required environment variables
function getRequiredEnvVar(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

// Helper function to get optional environment variables with default
function getEnvVar(name: string, defaultValue: string): string {
    return process.env[name] || defaultValue;
}

// Configuration object
export const CONFIG: AppConfig = {
    cloudflare: {
        accountId: getRequiredEnvVar('CF_ACCOUNT_ID'),
        gatewayId: getRequiredEnvVar('CF_GATEWAY_ID'),
        gatewayApiKey: getRequiredEnvVar('CF_GATEWAY_API_KEY'),
        endpoint: `https://gateway.ai.cloudflare.com/v1/${getRequiredEnvVar('CF_ACCOUNT_ID')}/${getRequiredEnvVar('CF_GATEWAY_ID')}`,
    },
    llm: {
        provider: getRequiredEnvVar('LLM_PROVIDER'),
        apiKey: getRequiredEnvVar('LLM_API_KEY'),
    },
    s3: {
        bucketName: getRequiredEnvVar('S3_BUCKET_NAME'),
        accessKeyId: getRequiredEnvVar('S3_ACCESS_KEY'),
        secretAccessKey: getRequiredEnvVar('S3_SECRET_KEY'),
        endpoint: 'https://gateway.storjshare.io',
    },
    server: {
        port: parseInt(getEnvVar('PORT', '3000'), 10),
        environment: getEnvVar('NODE_ENV', 'development'),
        isDev: process.env.NODE_ENV !== 'production',
    }
};

// Log startup configuration (excluding sensitive data)
if (CONFIG.server.isDev) {
    console.log('Development mode: Loading configuration from .env file');
    console.log(`LLM Provider: ${CONFIG.llm.provider}`);
    console.log(`S3 Endpoint: ${CONFIG.s3.endpoint}`);
    console.log(`S3 Bucket Name: ${CONFIG.s3.bucketName}`);
} else {
    console.log('Production mode: Using environment variables from container runtime');
} 