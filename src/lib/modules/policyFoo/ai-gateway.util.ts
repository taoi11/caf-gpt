/**
 * AI Gateway Service for PolicyFoo
 * 
 * Independent AI Gateway service for PolicyFoo module.
 * Handles LLM interactions using AI Gateway with OpenRouter provider.
 * Provides text generation, cost tracking, and error handling.
 */

import OpenAI from 'openai';
import type { 
	PolicyAIGatewayConfig, 
	PolicyAIGatewayMessage, 
	PolicyAIGatewayResponse, 
	PolicyFooError 
} from './types';
import { DEFAULT_AI_CONFIG, ERROR_MESSAGES } from './constants';

/**
 * PolicyFoo AI Gateway Service
 * 
 * Independent implementation for policy-related AI operations.
 * Supports multiple models and error handling.
 */
export class PolicyAIGatewayService {
	private openai: OpenAI;
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

		// Initialize OpenAI client with AI Gateway configuration
		const headers: Record<string, string> = {
			'X-Title': 'caf-gpt'
		};
		
		// Add CF AI Gateway authorization header if provided
		if (cafAigToken) {
			headers['cf-aig-authorization'] = `Bearer ${cafAigToken}`;
		}

		this.openai = new OpenAI({
			apiKey: openrouterToken,
			baseURL: aiGatewayBaseUrl,
			defaultHeaders: headers
		});
	}

	/**
	 * Generate text completion using the configured model
	 * 
	 * @param messages - Array of messages for the conversation
	 * @returns Promise with the response and usage statistics
	 */
	async generateCompletion(messages: PolicyAIGatewayMessage[]): Promise<PolicyAIGatewayResponse> {
		try {
			const response = await this.openai.chat.completions.create({
				model: this.config.model,
				messages: messages,
				max_tokens: this.config.maxTokens,
				temperature: this.config.temperature,
				top_p: this.config.topP
			});

			const content = response.choices[0]?.message?.content;
			if (!content) {
				throw this.createError('AI_GATEWAY_ERROR', 'No content in response');
			}

			return {
				response: content,
				usage: response.usage ? {
					prompt_tokens: response.usage.prompt_tokens,
					completion_tokens: response.usage.completion_tokens,
					total_tokens: response.usage.total_tokens
				} : undefined
			};

		} catch (error) {
			console.error('AI Gateway error:', error);
			throw this.createError('AI_GATEWAY_ERROR', 
				error instanceof Error ? error.message : 'Unknown AI Gateway error', 
				{ originalError: error }
			);
		}
	}

	/**
	 * Create a standardized error object
	 */
	private createError(code: PolicyFooError['code'], message: string, details?: Record<string, unknown>): PolicyFooError {
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
	 */
	updateConfig(newConfig: Partial<PolicyAIGatewayConfig>): void {
		this.config = {
			...this.config,
			...newConfig
		};
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

	return new PolicyAIGatewayService(
		openrouterToken,
		aiGatewayBaseUrl,
		cafAigToken,
		config
	);
}
