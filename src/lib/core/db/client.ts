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
		const dbError = error instanceof Error ? error : new Error(String(error));

		console.error('Database query failed:', {
			error: dbError.message,
			sql: text.substring(0, 50) + '...'
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
