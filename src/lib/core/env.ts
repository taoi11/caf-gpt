/**
 * Environment Configuration Utilities
 *
 * Centralized environment variable handling for both Cloudflare Workers and Node.js environments.
 * Provides consistent env access and validation across the application.
 */

import type { AppEnvironment } from './common.types.js';

/**
 * Get normalized environment variables from either Cloudflare Workers or Node.js
 */
export function getEnv(platform?: App.Platform): AppEnvironment {
	return (platform?.env ?? process.env) as AppEnvironment;
}

/**
 * Validation result for environment configuration
 */
export interface EnvValidationResult<T = Record<string, any>> {
	isValid: boolean;
	config?: T;
	missingVars?: string[];
}

/**
 * Validate required environment variables
 */
export function validateRequiredEnv<T>(
	env: Partial<AppEnvironment>,
	requiredKeys: Array<{ key: keyof AppEnvironment; value?: string | undefined }>
): EnvValidationResult<T> {
	const missingVars = requiredKeys.filter(({ value }) => !value).map(({ key }) => key as string);

	if (missingVars.length > 0) {
		return {
			isValid: false,
			missingVars
		};
	}

	// Build config from validated env vars
	const config = {} as T;
	for (const { key } of requiredKeys) {
		(config as Record<string, any>)[key as string] = env[key];
	}

	return {
		isValid: true,
		config
	};
}

/**
 * Check if all required environment variables are present
 */
export function hasRequiredEnv(
	platform: App.Platform | undefined,
	requiredKeys: (keyof AppEnvironment)[]
): boolean {
	const env = getEnv(platform);
	return requiredKeys.every((key) => Boolean(env[key]));
}
