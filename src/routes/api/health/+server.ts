import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ platform }) => {
	const status = {
		timestamp: new Date().toISOString(),
		service: 'CAF GPT API',
		version: '2.0.0',
		status: 'healthy',
		checks: {
			ai: false,
			auth: false,
			storage: false
		}
	};

	try {
		// Check AI binding
		if (platform?.env?.AI) {
			try {
				// Try a simple AI call to verify it's working
				const testResponse = await platform.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
					messages: [{ role: 'user', content: 'Test' }],
					max_tokens: 5
				});
				status.checks.ai = !!testResponse;
			} catch (error) {
				console.warn('AI health check failed:', error);
				status.checks.ai = false;
			}
		}

		// Check R2 storage
		status.checks.storage = !!platform?.env?.POLICIES;

		// Determine overall status
		const allHealthy = Object.values(status.checks).every((check) => check === true);
		status.status = allHealthy ? 'healthy' : 'degraded';

		return json(status, {
			status: allHealthy ? 200 : 503,
			headers: {
				'Cache-Control': 'no-cache, no-store, must-revalidate',
				'Content-Type': 'application/json'
			}
		});
	} catch (error) {
		console.error('Health check error:', error);

		return json(
			{
				...status,
				status: 'unhealthy',
				error: 'Health check failed'
			},
			{
				status: 503,
				headers: {
					'Cache-Control': 'no-cache, no-store, must-revalidate',
					'Content-Type': 'application/json'
				}
			}
		);
	}
};
