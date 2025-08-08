/**
 * Database client using Cloudflare Hyperdrive for optimized connection pooling
 * Using node-postgres (pg) driver as recommended by Cloudflare for Hyperdrive + Neon
 * This avoids WebSocket issues that occur with @neondatabase/serverless during compute suspension
 */
import { Client } from 'pg';

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
		// node-postgres (pg) works better with Hyperdrive than @neondatabase/serverless
		client = new Client({
			connectionString: hyperdrive.connectionString
		});
		await client.connect();

		// Execute query with performance logging
		const startTime = Date.now();
		const res = await client.query(text, params);
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
		
		// Handle database connection and query errors
		if (error instanceof Error) {
			dbError = error;
		} else if (error && typeof error === 'object' && 'message' in error) {
			dbError = new Error(String(error.message));
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
