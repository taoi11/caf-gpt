/**
 * Minimal PostgreSQL client for neon.tech serverless database.
 * Uses direct connections rather than a persistent pool for better cold start performance.
 */
import { Pool } from 'pg';
import { logger } from './logger';

// Database configuration from environment variables
const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: true
};
// Create a minimal pool - Neon handles connection pooling
const pool = new Pool(dbConfig);
// Log pool errors
pool.on('error', (err) => {
  logger.error('Unexpected database error', {
    error: err.message,
    stack: err.stack
  });
});
// Simple database client for executing queries
export const dbClient = {
  // Execute a query with parameters
  async query(text: string, params: any[] = []) {
    const start = Date.now();
    // Execute query
    try {
      const result = await pool.query(text, params);
      const duration = Date.now() - start;
      // Log query execution
      logger.debug('Executed query', {
        text,
        duration,
        rows: result.rowCount
      });
      // Return query result
      return result;
    } catch (error) {
      logger.error('Query error', {
        text,
        params,
        error: error instanceof Error ? error.message : String(error)
      });
      // Throw error for caller to handle
      throw error;
    } 
  }
}; 