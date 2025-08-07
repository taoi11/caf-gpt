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
