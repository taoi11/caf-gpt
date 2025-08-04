import { Client } from '@neondatabase/serverless';

/**
 * Execute a database query using Neon's recommended approach for Cloudflare Workers
 * Creates a new client instance per request to avoid I/O context violations
 */
export const query = async (text: string, params?: any[], retries: number = 2): Promise<any[]> => {
	let lastError: Error | null = null;

	for (let attempt = 0; attempt <= retries; attempt++) {
		let client: Client | null = null;

		try {
			// Create a new client for this request (Neon recommended pattern)
			client = new Client(process.env.DATABASE_URL!);
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
			lastError = error instanceof Error ? error : new Error(String(error));

			// Log retry attempts
			if (attempt < retries) {
				console.warn(`Database query attempt ${attempt + 1} failed, retrying:`, {
					error: lastError.message,
					sql: text.substring(0, 50) + '...',
					attempt: attempt + 1,
					maxRetries: retries
				});

				// Exponential backoff: 100ms, 200ms, 400ms
				await new Promise((resolve) => setTimeout(resolve, 100 * Math.pow(2, attempt)));
			}
		} finally {
			// Close the client connection
			if (client) {
				await client.end();
			}
		}
	}

	// If all retries failed, throw the last error
	console.error('All database query retries failed:', {
		error: lastError?.message,
		sql: text.substring(0, 50) + '...',
		totalAttempts: retries + 1
	});

	throw new Error(
		`Database query failed after ${retries + 1} attempts: ${lastError?.message || 'Unknown error'}`
	);
};

/**
 * Check database connection health
 */
export const healthCheck = async (): Promise<boolean> => {
	try {
		const result = await query('SELECT 1 as health');
		return result.length > 0 && result[0].health === 1;
	} catch (error) {
		console.error('Database health check failed:', error);
		return false;
	}
};
