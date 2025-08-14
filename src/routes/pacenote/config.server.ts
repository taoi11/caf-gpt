/**
 * Configuration validation for PaceNote route server-side operations
 */

import { getEnv, validateRequiredEnv, hasRequiredEnv } from '$lib/core/env.js';
import type { EnvValidationResult } from '$lib/core/env.js';

interface PaceNoteConfig {
	OPENROUTER_TOKEN: string;
	AI_GATEWAY_BASE_URL: string;
	FN_MODEL: string;
	CF_AIG_TOKEN?: string;
}

/**
 * Validate and extract environment configuration
 */
export function validateEnvironmentConfig(
	platform?: App.Platform
): EnvValidationResult<PaceNoteConfig> {
	const env = getEnv(platform);

	const requiredVars = [
		{ key: 'OPENROUTER_TOKEN' as const, value: env.OPENROUTER_TOKEN },
		{ key: 'AI_GATEWAY_BASE_URL' as const, value: env.AI_GATEWAY_BASE_URL },
		{ key: 'FN_MODEL' as const, value: env.FN_MODEL }
	];

	const result = validateRequiredEnv<PaceNoteConfig>(env, requiredVars);

	if (result.isValid && result.config) {
		// Add optional CF_AIG_TOKEN
		result.config.CF_AIG_TOKEN = env.CF_AIG_TOKEN;
	}

	return result;
}

/**
 * Check if all required services are configured
 */
export function hasRequiredConfig(platform?: App.Platform): boolean {
	return hasRequiredEnv(platform, ['OPENROUTER_TOKEN', 'AI_GATEWAY_BASE_URL', 'FN_MODEL']);
}
