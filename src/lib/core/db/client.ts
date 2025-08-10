/**
 * Database client using Cloudflare Hyperdrive for optimized connection pooling
 * Hyperdrive provides connection pooling and caching for better CF Workers performance
 */
import { Client } from '@neondatabase/serverless';

/**
 * Execute a database query using Hyperdrive connection pooling
 * Hyperdrive handles connection management automatically for CF Workers
 */
export const query = async (
	text: string,
	hyperdrive: Hyperdrive,
	params?: any[]
): Promise<any[]> => {
	let client: Client | null = null;

	try {
		// Create a new client using Hyperdrive connection string
		client = new Client(hyperdrive.connectionString);
		await client.connect();

		// Execute query with performance logging and timeout
		const startTime = Date.now();
		
		// Set up a timeout to prevent hanging queries in serverless environment
		const queryPromise = client.query(text, params);
		const timeoutPromise = new Promise((_, reject) => {
			setTimeout(() => reject(new Error('Query timeout after 10 seconds')), 10000);
		});
		
		const res = await Promise.race([queryPromise, timeoutPromise]) as any;
		const duration = Date.now() - startTime;

		// Log slow queries (>500ms) for monitoring
		if (duration > 500) {
			console.warn(`Slow query detected (${duration}ms):`, {
				sql: text.substring(0, 100) + '...',
				duration,
				rowCount: res.rows.length
			});
		}

		return res.rows;
	} catch (error) {
		let dbError: Error;
		
		// Handle specific connection errors
		if (error && typeof error === 'object' && 'message' in error) {
			const errorMessage = String(error.message || error);
			
			// Check for WebSocket connection failures (common with Neon)
			if (errorMessage.includes('WebSocket connection') || errorMessage.includes('530')) {
				dbError = new Error(`Database connection failed: ${errorMessage}. This may be a temporary connectivity issue.`);
			} else if (errorMessage.includes('ErrorEvent')) {
				dbError = new Error(`Database connection error: Please check your database configuration.`);
			} else {
				dbError = new Error(errorMessage);
			}
		} else if (error instanceof Error) {
			dbError = error;
		} else {
			dbError = new Error(String(error));
		}
		
		console.error('Database query failed:', {
			error: dbError.message,
			errorType: error?.constructor?.name || typeof error,
			sql: text.substring(0, 50) + '...',
			timestamp: new Date().toISOString()
		});
		
		throw dbError;
	} finally {
		// Close the client connection
		if (client) {
			await client.end();
		}
	}
};

/**
 * Check database connection health
 */
export const healthCheck = async (hyperdrive: Hyperdrive): Promise<boolean> => {
	try {
		const result = await query('SELECT 1 as health', hyperdrive);
		return result.length > 0 && result[0].health === 1;
	} catch (error) {
		console.error('Database health check failed:', error);
		return false;
	}
};
