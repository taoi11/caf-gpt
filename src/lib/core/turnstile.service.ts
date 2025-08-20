/**
 * Turnstile Service
 *
 * Minimal server-side Turnstile token validation
 */

import type { TurnstileValidationResult } from './turnstile.types.js';

/**
 * Validates a Turnstile token with Cloudflare's siteverify API
 */
export async function validateTurnstileToken(
	token: string,
	secretKey: string,
	remoteIp?: string
): Promise<TurnstileValidationResult> {
	if (!token) {
		return {
			success: false,
			'error-codes': ['missing-input-response']
		};
	}

	if (!secretKey) {
		return {
			success: false,
			'error-codes': ['missing-input-secret']
		};
	}

	try {
		const formData = new FormData();
		formData.append('secret', secretKey);
		formData.append('response', token);

		if (remoteIp) {
			formData.append('remoteip', remoteIp);
		}

		const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
			method: 'POST',
			body: formData
		});

		if (!response.ok) {
			return {
				success: false,
				'error-codes': ['network-error']
			};
		}

		const result = (await response.json()) as TurnstileValidationResult;
		return result;
	} catch (error) {
		console.error('Turnstile validation error:', error);
		return {
			success: false,
			'error-codes': ['internal-error']
		};
	}
}
