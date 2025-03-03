/**
 * Application boot-up process that validates external services and initializes resources.
 * Optimized for cold starts by running non-critical validations in the background.
 */
import { dbClient } from './dbClient';
import { logger } from './logger';
// Application state
export const appState = {
  isDbConnected: false,
  isLlmKeyValid: false,
  isS3Valid: false,
  isBootupComplete: false,
  errors: [] as string[]
};
// Quick startup function that only checks critical services
// Returns immediately to allow server to start serving requests
export async function quickStartup(): Promise<void> {
  logger.info('Starting quick application startup');
  // Start background validation
  runBackgroundValidation().catch(error => {
    logger.error('Background validation failed', {
      error: error instanceof Error ? error.message : String(error)
    });
  });
  logger.info('Quick startup complete, server ready to handle requests');
}

// Runs all validation checks in the background
// This doesn't block the server from starting
async function runBackgroundValidation(): Promise<void> {
  logger.info('Starting background validation');
  try {
    // Initialize database
    await initializeDatabase();
    // Validate LLM API key
    await validateLLMApiKey();
    // Check S3 credentials
    await validateS3Credentials();
    // Mark bootup as complete
    appState.isBootupComplete = true;
    logger.info('Background validation completed successfully');
  } catch (error) {
    logger.error('Background validation failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    appState.errors.push(`Validation: ${error instanceof Error ? error.message : String(error)}`);
  }
}
// Initialize database and create costs table if it doesn't exist
async function initializeDatabase() {
  try {
    logger.info('Initializing database connection');
    // Test connection
    await dbClient.query('SELECT NOW()');
    appState.isDbConnected = true;
    // Create costs table if it doesn't exist
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS costs (
        id INTEGER PRIMARY KEY DEFAULT 1,
        api_costs DECIMAL(10, 6) NOT NULL DEFAULT 0,
        server_costs DECIMAL(10, 6) NOT NULL DEFAULT 15.70,
        last_reset DATE NOT NULL DEFAULT CURRENT_DATE,
        last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT single_record CHECK (id = 1)
      )
    `);
    // Insert initial record if none exists
    await dbClient.query(`
      INSERT INTO costs (id, api_costs, server_costs, last_reset, last_updated)
      VALUES (1, 0, 15.70, CURRENT_DATE, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO NOTHING
    `);
    logger.info('Database initialization complete');
  } catch (error) {
    logger.error('Database initialization failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    appState.errors.push(`Database init: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
// Validate LLM API key
async function validateLLMApiKey() {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    logger.error('LLM API key is missing');
    appState.errors.push('LLM API key is missing');
    return;
  }
  try {
    // Simple validation request to OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://caf-gpt.com',
        'X-Title': 'CAF-GPT'
      }
    });
    // Throw error if validation fails
    if (!response.ok) {
      throw new Error(`API key validation failed: ${response.status} ${response.statusText}`);
    }
    // Set state to valid
    appState.isLlmKeyValid = true;
    logger.info('LLM API key validated successfully');
  } catch (error) {
    logger.error('LLM API key validation failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    appState.errors.push(`LLM API: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Validate S3 credentials
async function validateS3Credentials() {
  try {
    // Import S3 client
    const { s3Client } = await import('./s3Client');
    // Test S3 connection with a simple operation
    await s3Client.send(new (await import('@aws-sdk/client-s3')).ListBucketsCommand({}));
    // Set state to valid
    appState.isS3Valid = true;
    logger.info('S3 credentials validated successfully');
  } catch (error) {
    logger.error('S3 credentials validation failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    appState.errors.push(`S3: ${error instanceof Error ? error.message : String(error)}`);
  }
}
// Health check endpoint helper, returns the current state of services for monitoring
export function getHealthStatus() {
  return {
    status: appState.isBootupComplete ? 'ready' : 'initializing',
    database: appState.isDbConnected ? 'connected' : 'disconnected',
    llmApi: appState.isLlmKeyValid ? 'valid' : 'invalid',
    s3Storage: appState.isS3Valid ? 'valid' : 'invalid',
    errors: appState.errors.length > 0 ? appState.errors : undefined
  };
} 