# PostgreSQL Integration for Cost Tracking

## Current Implementation Analysis

The application currently uses a file-based approach to track costs:

### Storage
- Costs are stored in a JSON file at `data/costs.json`
- File operations use Node.js `fs/promises` module
- Data is loaded on startup and saved after each update

### Data Structure
```json
{
  "apiCosts": 0.00015,        // Monthly LLM API costs in USD
  "serverCosts": 15.7,        // Monthly server costs in USD (fixed at $15.70)
  "lastReset": "2025-03-02",  // Date of last monthly reset
  "lastUpdated": "2025-03-02T03:48:35.964Z"  // Timestamp of last update
}
```

### Key Operations
- `trackRequest()`: Tracks costs from OpenRouter API calls
- `trackUsage()`: Estimates costs based on token usage
- `getCostData()`: Returns current cost data
- Monthly reset on the first day of each month

### API Endpoint
- `/api/costs` endpoint to retrieve cost data
- Used by the frontend to display current costs

## Challenges with fly.io Deployment

When deploying to fly.io, there are several challenges with the current file-based approach:

1. **Ephemeral Storage**: fly.io instances use ephemeral storage, meaning file-based data will be lost when instances restart or scale.

2. **Multi-instance Consistency**: If you scale to multiple instances, each would have its own cost data file, leading to inconsistent cost tracking.

3. **Data Persistence**: You need a persistent storage solution that survives deployments and restarts.

4. **Deployment Simplicity**: Managing file storage adds complexity to deployment and scaling.

5. **Cold Start Performance**: fly.io machines can scale to zero and cold start when a request comes in, so boot-up processes need to be optimized for quick response times.

## Recommended Solution: Neon.tech Serverless PostgreSQL

Given the small user base (tens of users) and the need for simplicity, neon.tech serverless PostgreSQL is an excellent choice:

### 1. Why Neon.tech Serverless PostgreSQL?

- **Serverless Architecture**: Perfect for low-traffic applications with minimal overhead
- **Cost-Effective**: Pay only for what you use, ideal for small user bases
- **Auto-Scaling**: Scales down to zero when not in use, reducing costs further
- **Persistence**: Data survives instance restarts and scaling
- **Built-in Connection Pooling**: Neon handles connection pooling for us
- **Automatic Backups**: Neon provides backup capabilities out of the box

### 2. Simplified Implementation Approach

#### Minimal Database Schema
```sql
CREATE TABLE IF NOT EXISTS costs (
  id INTEGER PRIMARY KEY DEFAULT 1,
  api_costs DECIMAL(10, 6) NOT NULL DEFAULT 0,
  server_costs DECIMAL(10, 6) NOT NULL DEFAULT 15.70,
  last_reset DATE NOT NULL DEFAULT CURRENT_DATE,
  last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT single_record CHECK (id = 1)
);
```

#### Lightweight Dependencies
```json
{
  "dependencies": {
    "pg": "^8.11.3"
  }
}
```

#### Optimized Boot-Up Process for Cold Starts

Create a new module `src/server/utils/bootup.ts` that prioritizes serving web pages quickly:

```typescript
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

/**
 * Quick startup function that only checks critical services
 * Returns immediately to allow server to start serving requests
 */
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

/**
 * Runs all validation checks in the background
 * This doesn't block the server from starting
 */
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
    
    if (!response.ok) {
      throw new Error(`API key validation failed: ${response.status} ${response.statusText}`);
    }
    
    appState.isLlmKeyValid = true;
    logger.info('LLM API key validated successfully');
  } catch (error) {
    logger.error('LLM API key validation failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    appState.errors.push(`LLM API: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function validateS3Credentials() {
  try {
    // Import S3 client
    const { s3Client } = await import('./s3Client');
    
    // Test S3 connection with a simple operation
    await s3Client.send(new (await import('@aws-sdk/client-s3')).ListBucketsCommand({}));
    
    appState.isS3Valid = true;
    logger.info('S3 credentials validated successfully');
  } catch (error) {
    logger.error('S3 credentials validation failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    appState.errors.push(`S3: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Health check endpoint helper
 * Returns the current state of services for monitoring
 */
export function getHealthStatus() {
  return {
    status: appState.isBootupComplete ? 'ready' : 'initializing',
    database: appState.isDbConnected ? 'connected' : 'disconnected',
    llmApi: appState.isLlmKeyValid ? 'valid' : 'invalid',
    s3Storage: appState.isS3Valid ? 'valid' : 'invalid',
    errors: appState.errors.length > 0 ? appState.errors : undefined
  };
}
```

#### Simplified Database Client

```typescript
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

/**
 * Simple database client for executing queries
 */
export const dbClient = {
  /**
   * Execute a query with parameters
   */
  async query(text: string, params: any[] = []) {
    const start = Date.now();
    try {
      const result = await pool.query(text, params);
      const duration = Date.now() - start;
      
      logger.debug('Executed query', {
        text,
        duration,
        rows: result.rowCount
      });
      
      return result;
    } catch (error) {
      logger.error('Query error', {
        text,
        params,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
};
```

#### Cost Tracker with Simple Error Handling

```typescript
/**
 * Cost tracking system with database persistence.
 * Simplified implementation with basic error handling.
 */
import { logger } from './logger';
import { dbClient } from './dbClient';
import { appState } from './bootup';
import type { CostData, LLMResponse } from '../types';

const MONTHLY_SERVER_COST = 15.70; // Base monthly server cost in USD
const OPENROUTER_API_KEY = process.env.LLM_API_KEY || '';

class CostTracker {
    private data: CostData = {
        apiCosts: 0,
        serverCosts: MONTHLY_SERVER_COST,
        lastReset: new Date().toISOString().split('T')[0],
        lastUpdated: new Date().toISOString()
    };
    
    constructor() {
        this.initializeStorage().catch(error => {
            logger.error('Failed to initialize cost tracker:', error);
        });
    }

    private async initializeStorage(): Promise<void> {
        try {
            await this.loadData();
            await this.checkMonthlyReset();
        } catch (error) {
            logger.error('Failed to initialize storage', {
                error: error instanceof Error ? error.message : String(error)
            });
            // Continue with default values
        }
    }

    private async checkMonthlyReset(): Promise<void> {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        
        // Check if it's the first day of the month
        if (now.getDate() === 1) {
            const lastResetDate = new Date(this.data.lastReset);
            
            // Only reset if we haven't already reset this month
            if (lastResetDate.getMonth() !== now.getMonth() || 
                lastResetDate.getFullYear() !== now.getFullYear()) {
                logger.info('Performing monthly cost reset');
                this.data.apiCosts = 0;
                this.data.serverCosts = MONTHLY_SERVER_COST;
                this.data.lastReset = today;
                await this.saveData();
            }
        }
    }

    private async loadData(): Promise<void> {
        try {
            const result = await dbClient.query(
                'SELECT api_costs, server_costs, last_reset::text, last_updated::text FROM costs WHERE id = 1'
            );
            
            if (result.rows.length > 0) {
                const row = result.rows[0];
                this.data = {
                    apiCosts: parseFloat(row.api_costs),
                    serverCosts: parseFloat(row.server_costs),
                    lastReset: row.last_reset,
                    lastUpdated: row.last_updated
                };
                logger.info('Cost data loaded successfully from database');
            } else {
                logger.info('No existing cost data found in database, using defaults');
                await this.saveData();
            }
        } catch (error) {
            logger.error('Error loading cost data from database', {
                error: error instanceof Error ? error.message : String(error)
            });
            // Continue with default values
        }
    }

    private async saveData(): Promise<void> {
        try {
            await dbClient.query(
                'UPDATE costs SET api_costs = $1, server_costs = $2, last_reset = $3, last_updated = $4 WHERE id = 1',
                [this.data.apiCosts, this.data.serverCosts, this.data.lastReset, this.data.lastUpdated]
            );
            logger.debug('Cost data saved successfully to database');
        } catch (error) {
            logger.error('Failed to save cost data to database', {
                error: error instanceof Error ? error.message : String(error)
            });
            // Continue without saving - will try again next time
        }
    }

    // Rest of the implementation remains the same...
    // fetchGenerationCost, trackRequest, trackUsage, getCostData
    
    /**
     * Returns current cost data
     * Always returns data even if database operations fail
     */
    public getCostData(): CostData {
        return { ...this.data };
    }
}

// Export singleton instance
export const costTracker = new CostTracker();
```

#### Enhanced Cost API Endpoint

Update the cost API endpoint to handle errors gracefully:

```typescript
// In src/server/index.ts

// Cost endpoint with improved error handling
if (url === '/api/costs' && method === 'GET') {
    try {
        const costs = costTracker.getCostData();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(costs));
        logger.logRequest(method, url, 200);
    } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        logger.error('Error fetching costs', {
            error: err.message,
            stack: err.stack
        });
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            error: 'Failed to fetch costs',
            message: err.message
        }));
        logger.logRequest(method, url, 500);
    }
    return;
}
```

#### Health Check Endpoint

Add a simple health check endpoint:

```typescript
// In src/server/index.ts

// Health check endpoint
if (url === '/health') {
    const healthStatus = getHealthStatus();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(healthStatus));
    return;
}
```

### 3. Integration with Server Startup for Fast Cold Starts

In your main server file (e.g., `src/server/index.ts`), update the startup process to prioritize serving requests:

```typescript
import { quickStartup, getHealthStatus } from './utils/bootup';
import { logger } from './utils/logger';
import { createServer } from 'http';
import { PORT } from './utils/config';

// Start the server immediately
const server = createServer(async (req, res) => {
  // Existing server code
  
  // Enhanced health check endpoint
  if (url === '/health') {
    const healthStatus = getHealthStatus();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(healthStatus));
    return;
  }
  
  // Rest of your request handling
});

server.listen(PORT, () => {
  logger.info(`Server started on port ${PORT}`);
  
  // Run quick startup after server is listening
  quickStartup().catch(error => {
    logger.error('Quick startup failed', {
      error: error instanceof Error ? error.message : String(error)
    });
  });
});
```

### 4. fly.io Setup with Neon.tech

#### Neon.tech Setup
1. Create a free account at neon.tech
2. Create a new project
3. Create a database
4. Get the connection string from the dashboard

#### Application Configuration
```bash
# Set database connection string as a secret
flyctl secrets set DATABASE_URL=postgres://user:password@your-neon-db-host/dbname
```

#### Deployment Configuration
Update `fly.toml` to include:
```toml
[env]
  PORT = "8080"
  NODE_ENV = "production"

# Configure health checks
[checks]
  [checks.health]
    port = 8080
    type = "http"
    interval = "10s"
    timeout = "2s"
    grace_period = "5s"
    method = "GET"
    path = "/health"
    protocol = "http"
```

## Conclusion

For a small application with tens of users, neon.tech serverless PostgreSQL offers the perfect balance of simplicity, cost-effectiveness, and reliability. The optimized boot-up process ensures fast cold starts while still validating dependencies in the background.

This approach:
- Prioritizes serving web pages quickly during cold starts
- Runs validation checks in the background
- Provides a simple health check endpoint
- Uses Neon's built-in connection pooling and backup capabilities
- Minimizes operational costs with serverless scaling
- Maintains the current application functionality

The implementation is simple, minimal, and well-suited for fly.io's scaling behavior, ensuring your application remains responsive even with infrequent usage. 