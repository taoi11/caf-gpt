/**
 * Environment Configuration Utility
 *
 * Handles environment variable validation and configuration setup
 * for the PaceNote server functionality.
 */

interface PaceNoteConfig {
	openrouterToken: string;
	aiGatewayBaseUrl: string;
	model: string;
	cfAigToken?: string;
	policiesBucket?: R2Bucket;
}

interface ConfigValidationResult {
	isValid: boolean;
	config?: PaceNoteConfig;
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
		{ key: 'AI_GATEWAY_BASE_URL', value: env?.AI_GATEWAY_BASE_URL },
		{ key: 'FN_MODEL', value: env?.FN_MODEL }
	];

	const missingVars = requiredVars.filter(({ value }) => !value).map(({ key }) => key);

	if (missingVars.length > 0) {
		return {
			isValid: false,
			missingVars
		};
	}

	return {
		isValid: true,
		config: {
			openrouterToken: env.OPENROUTER_TOKEN!,
			aiGatewayBaseUrl: env.AI_GATEWAY_BASE_URL!,
			model: env.FN_MODEL!,
			cfAigToken: env.CF_AIG_TOKEN,
			policiesBucket: platform?.env?.POLICIES
		}
	};
}

/**
 * Check if all required services are configured
 */
export function hasRequiredConfig(platform?: App.Platform): boolean {
	const env = platform?.env || process.env;

	return Boolean(env?.OPENROUTER_TOKEN && env?.AI_GATEWAY_BASE_URL && env?.FN_MODEL);
}

/**
 * Validate R2 bucket availability (Cloudflare Workers only)
 */
export function validateR2Bucket(platform?: App.Platform): boolean {
	return Boolean(platform?.env?.POLICIES);
}
