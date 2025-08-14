/**
 * Configuration validation for Policy route server-side operations
 */

import { getEnv, validateRequiredEnv, hasRequiredEnv } from '$lib/core/env.js';
import type { EnvValidationResult } from '$lib/core/env.js';

interface PolicyConfig {
	OPENROUTER_TOKEN: string;
	AI_GATEWAY_BASE_URL: string;
	READER_MODEL?: string;
	MAIN_MODEL?: string;
	CF_AIG_TOKEN?: string;
	HYPERDRIVE: Hyperdrive;
}

/**
 * Validate and extract environment configuration
 */
export function validateEnvironmentConfig(
	platform?: App.Platform
): EnvValidationResult<PolicyConfig> {
	const env = getEnv(platform);

	const requiredVars = [
		{ key: 'OPENROUTER_TOKEN' as const, value: env.OPENROUTER_TOKEN },
		{ key: 'AI_GATEWAY_BASE_URL' as const, value: env.AI_GATEWAY_BASE_URL }
	];

	const result = validateRequiredEnv<Partial<PolicyConfig>>(env, requiredVars);

	// Check for required bindings (only available in Cloudflare Workers)
	if (platform?.env) {
		if (!platform.env.HYPERDRIVE) {
			result.missingVars = result.missingVars || [];
			result.missingVars.push('HYPERDRIVE');
			result.isValid = false;
		}
	} else {
		// In non-Cloudflare environments, HYPERDRIVE binding won't be available
		result.missingVars = result.missingVars || [];
		result.missingVars.push('HYPERDRIVE');
		result.isValid = false;
	}

	if (result.isValid && result.config && platform?.env?.HYPERDRIVE) {
		// Build PolicyConfig object explicitly to ensure type safety
		const config: PolicyConfig = {
			OPENROUTER_TOKEN: env.OPENROUTER_TOKEN as string,
			AI_GATEWAY_BASE_URL: env.AI_GATEWAY_BASE_URL as string,
			READER_MODEL: env.READER_MODEL,
			MAIN_MODEL: env.MAIN_MODEL,
			CF_AIG_TOKEN: env.CF_AIG_TOKEN,
			HYPERDRIVE: platform.env.HYPERDRIVE
		};
		result.config = config;
	}

	return result as EnvValidationResult<PolicyConfig>;
}

/**
 * Check if all required services are configured
 */
export function hasRequiredConfig(platform?: App.Platform): boolean {
	return (
		hasRequiredEnv(platform, ['OPENROUTER_TOKEN', 'AI_GATEWAY_BASE_URL']) &&
		Boolean(platform?.env?.HYPERDRIVE)
	);
}
