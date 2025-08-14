/**
 * Configuration validation for Policy route server-side operations
 */

import '$lib/core/types.js'; // Import for environment type extensions

interface PolicyConfig {
	openrouterToken: string;
	aiGatewayBaseUrl: string;
	readerModel?: string;
	mainModel?: string;
	cfAigToken?: string;
	hyperdrive: Hyperdrive;
}

interface ConfigValidationResult {
	isValid: boolean;
	config?: PolicyConfig;
	missingVars?: string[];
}

/**
 * Validate and extract environment configuration
 */
export function validateEnvironmentConfig(platform?: App.Platform): ConfigValidationResult {
	// Get environment variables from either Cloudflare Workers or Node.js
	const env = platform?.env || process.env;

	const requiredVars = [
		{ key: 'OPENROUTER_TOKEN', value: env?.OPENROUTER_TOKEN },
		{ key: 'AI_GATEWAY_BASE_URL', value: env?.AI_GATEWAY_BASE_URL }
	];

	const missingVars = requiredVars.filter(({ value }) => !value).map(({ key }) => key);

	// Check for required bindings (only available in Cloudflare Workers)
	if (platform?.env) {
		if (!platform.env.HYPERDRIVE) {
			missingVars.push('HYPERDRIVE');
		}
	} else {
		// In non-Cloudflare environments, HYPERDRIVE binding won't be available
		missingVars.push('HYPERDRIVE');
	}

	if (missingVars.length > 0) {
		return {
			isValid: false,
			missingVars
		};
	}

	return {
		isValid: true,
		config: {
			openrouterToken: env!.OPENROUTER_TOKEN!,
			aiGatewayBaseUrl: env!.AI_GATEWAY_BASE_URL!,
			readerModel: env!.READER_MODEL,
			mainModel: env!.MAIN_MODEL,
			cfAigToken: env!.CF_AIG_TOKEN,
			hyperdrive: platform?.env?.HYPERDRIVE as Hyperdrive
		}
	};
}

/**
 * Check if all required services are configured
 */
export function hasRequiredConfig(platform?: App.Platform): boolean {
	const env = platform?.env || process.env;

	return Boolean(env?.OPENROUTER_TOKEN && env?.AI_GATEWAY_BASE_URL && platform?.env?.HYPERDRIVE);
}
