/**
 * Common Types
 *
 * App-wide types used across multiple modules.
 * These are shared interfaces and types that multiple modules depend on.
 */

// AI Gateway Types

export interface AIGatewayConfig {
	model: string;
	maxTokens?: number;
	temperature?: number;
	topP?: number;
}

export interface AIGatewayMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

export interface AIGatewayResponse {
	response: string;
	usage?: {
		prompt_tokens?: number;
		completion_tokens?: number;
		total_tokens?: number;
	};
}

export interface AIGatewayError {
	code: string;
	message: string;
	details?: Record<string, unknown>;
}

// App Environment Types

export interface AppEnvironment {
	OPENROUTER_TOKEN: string;
	AI_GATEWAY_BASE_URL: string;
	CF_AIG_TOKEN?: string;
	READER_MODEL?: string;
	MAIN_MODEL?: string;
	FN_MODEL?: string;
	// Turnstile (human verification)
	TURNSTILE_SITE_KEY?: string;
	TURNSTILE_SECRET_KEY?: string;
}
