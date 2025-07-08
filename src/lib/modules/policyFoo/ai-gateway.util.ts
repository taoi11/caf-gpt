/**
 * AI Gateway Service for PolicyFoo
 *
 * Wrapper around the shared AI Gateway service for PolicyFoo module.
 * Maintains PolicyFoo-specific error handling and API compatibility.
 */

import {
	AIGatewayService,
	createAIGatewayService,
	type AIGatewayConfig
} from '$lib/server/ai-gateway.service.js';
import type {
	PolicyAIGatewayConfig,
	PolicyAIGatewayMessage,
	PolicyAIGatewayResponse,
	PolicyFooError
} from './types.js';
import { DEFAULT_AI_CONFIG, ERROR_MESSAGES } from './constants.js';

/**
 * PolicyFoo AI Gateway Service
 *
 * Wrapper around shared AI Gateway service with PolicyFoo-specific error handling.
 */
export class PolicyAIGatewayService {
	private aiGateway: AIGatewayService;
	private config: PolicyAIGatewayConfig;

	constructor(
		openrouterToken: string,
		aiGatewayBaseUrl: string,
		cafAigToken: string,
		config: PolicyAIGatewayConfig
	) {
		this.config = {
			...DEFAULT_AI_CONFIG,
			...config
		};

		// Create shared AI Gateway service
		this.aiGateway = createAIGatewayService(
			openrouterToken,
			aiGatewayBaseUrl,
			this.config as AIGatewayConfig,
			cafAigToken
		);
	}

	/**
	 * Generate text completion using the configured model
	 *
	 * @param messages - Array of messages for the conversation
	 * @returns Promise with the response and usage statistics
	 */
	async generateCompletion(messages: PolicyAIGatewayMessage[]): Promise<PolicyAIGatewayResponse> {
		try {
			const response = await this.aiGateway.generateCompletion(messages);
			return response;
		} catch (error) {
			// Convert AI Gateway errors to PolicyFoo errors
			if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
				throw this.createError(
					'AI_GATEWAY_ERROR',
					typeof error.message === 'string' ? error.message : 'AI Gateway error',
					{ originalError: error }
				);
			}

			console.error('AI Gateway error:', error);
			throw this.createError(
				'AI_GATEWAY_ERROR',
				error instanceof Error ? error.message : 'Unknown AI Gateway error',
				{ originalError: error }
			);
		}
	}

	/**
	 * Create a standardized error object
	 */
	private createError(
		code: PolicyFooError['code'],
		message: string,
		details?: Record<string, unknown>
	): PolicyFooError {
		return {
			code,
			message: `${ERROR_MESSAGES[code]}: ${message}`,
			details
		};
	}

	/**
	 * Get current model configuration
	 */
	getConfig(): PolicyAIGatewayConfig {
		return { ...this.config };
	}

	/**
	 * Update model configuration
	 * Note: This creates a new underlying AI Gateway service instance
	 */
	updateConfig(newConfig: Partial<PolicyAIGatewayConfig>): void {
		this.config = {
			...this.config,
			...newConfig
		};
		// Note: The underlying AI Gateway service config cannot be updated dynamically
		// This method maintains API compatibility but doesn't update the service
		console.warn(
			'PolicyAIGatewayService: updateConfig called but underlying service config cannot be updated'
		);
	}
}

/**
 * Factory function to create AI Gateway service instances
 */
export function createPolicyAIGatewayService(
	openrouterToken: string,
	aiGatewayBaseUrl: string,
	cafAigToken: string,
	model: string,
	additionalConfig: Partial<PolicyAIGatewayConfig> = {}
): PolicyAIGatewayService {
	const config: PolicyAIGatewayConfig = {
		model,
		...additionalConfig
	};

	return new PolicyAIGatewayService(openrouterToken, aiGatewayBaseUrl, cafAigToken, config);
}
