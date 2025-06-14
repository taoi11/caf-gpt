/**
 * Authentication middleware for API endpoints
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

/**
 * Validate API key from request headers
 */
export function validateApiKey(request: Request, apiKey: string): boolean {
	const authHeader = request.headers.get('Authorization');
	
	if (!authHeader) {
		return false;
	}

	// Support both "Bearer <key>" and "API-Key <key>" formats
	const token = authHeader.replace(/^(Bearer|API-Key)\s+/, '');
	
	return token === apiKey;
}

/**
 * Create authentication middleware that can be used in API routes
 */
export function createAuthMiddleware(apiKey: string) {
	return (request: Request) => {
		if (!validateApiKey(request, apiKey)) {
			return json(
				{ 
					error: 'Unauthorized',
					message: 'Invalid or missing API key',
					code: 'UNAUTHORIZED'
				},
				{ 
					status: 401,
					headers: {
						'WWW-Authenticate': 'Bearer realm="API"'
					}
				}
			);
		}
		return null; // null means auth passed
	};
}

/**
 * Rate limiting store (simple in-memory for now)
 * In production, consider using Durable Objects or external store
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Simple rate limiting - 10 requests per minute per IP
 */
export function checkRateLimit(clientIP: string): boolean {
	const now = Date.now();
	const windowMs = 60 * 1000; // 1 minute
	const maxRequests = 10;

	const key = clientIP;
	const current = rateLimitStore.get(key);

	if (!current || now > current.resetTime) {
		// First request or window expired
		rateLimitStore.set(key, {
			count: 1,
			resetTime: now + windowMs
		});
		return true;
	}

	if (current.count >= maxRequests) {
		return false; // Rate limit exceeded
	}

	// Increment count
	current.count++;
	return true;
}

/**
 * Get client IP from request
 */
export function getClientIP(request: Request): string {
	// Try various headers in order of preference
	const headers = [
		'CF-Connecting-IP', // Cloudflare
		'X-Forwarded-For',
		'X-Real-IP',
		'X-Client-IP'
	];

	for (const header of headers) {
		const value = request.headers.get(header);
		if (value) {
			// X-Forwarded-For can contain multiple IPs, take the first one
			return value.split(',')[0].trim();
		}
	}

	return 'unknown';
}
