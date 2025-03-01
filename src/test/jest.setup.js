/**
 * Jest setup configuration
 * 
 * This file contains setup code that runs before the tests
 * Prioritizes real .env variables
 */

/* eslint-env node */
/* eslint-disable @typescript-eslint/no-require-imports */
const dotenv = require('dotenv');

// Load environment variables from .env file
// This loads variables before any tests run
dotenv.config();

// Set fallback values ONLY if environment variables are not defined
// This preserves real .env values when available
if (!process.env.PORT) process.env.PORT = '3000';
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'test';
if (!process.env.LLM_API_KEY) process.env.LLM_API_KEY = 'test_key';
if (!process.env.PACE_NOTE_MODEL) process.env.PACE_NOTE_MODEL = 'test_model';
if (!process.env.DOAD_FINDER_MODEL) process.env.DOAD_FINDER_MODEL = 'test_model';
if (!process.env.DOAD_CHAT_MODEL) process.env.DOAD_CHAT_MODEL = 'test_model';
if (!process.env.S3_BUCKET_NAME) process.env.S3_BUCKET_NAME = 'test_bucket';
if (!process.env.S3_ACCESS_KEY) process.env.S3_ACCESS_KEY = 'test_access_key';
if (!process.env.S3_SECRET_KEY) process.env.S3_SECRET_KEY = 'test_secret_key';

// Set environment flags to use real services by default
process.env.USE_REAL_LLM_API = process.env.USE_REAL_LLM_API || 'true';
process.env.USE_REAL_S3 = process.env.USE_REAL_S3 || 'true';

// Enable verbose logging during tests by default
process.env.VERBOSE_TESTS = process.env.VERBOSE_TESTS || 'true'; 