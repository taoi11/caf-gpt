/**
 * Turnstile Types
 *
 * Minimal types for Cloudflare Turnstile integration
 */

export interface TurnstileValidationResult {
	success: boolean;
	'error-codes'?: string[];
	hostname?: string;
	'challenge-ts'?: string;
	action?: string;
}

export interface TurnstileConfig {
	siteKey: string;
	secretKey: string;
}
