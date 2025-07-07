/**
 * AI Gateway Service
 * 
 * Shared service for LLM interactions using AI Gateway with OpenRouter provider.
 * Used across multiple modules for consistent AI integration.
 * Provides text generation, cost tracking, and error handling.
 */

import OpenAI from 'openai';

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

/**
 * Default configuration for AI Gateway
 */
const DEFAULT_CONFIG: Partial<AIGatewayConfig> = {
	temperature: 0.1
};

export class AIGatewayService {
	private openai: OpenAI;
	private config: AIGatewayConfig;

	constructor(
		openrouterToken: string,
		aiGatewayBaseURL: string,
		config: AIGatewayConfig,
		cfAigToken?: string
	) {
		// X-Title header identifies the application to the AI Gateway (change as needed)
		const headers: Record<string, string> = {
			'X-Title': 'caf-gpt'
		};
		
		// Add CF AI Gateway authorization header if provided
		if (cfAigToken) {
			headers['cf-aig-authorization'] = `Bearer ${cfAigToken}`;
		}

		this.openai = new OpenAI({
			apiKey: openrouterToken,
			baseURL: aiGatewayBaseURL,
			defaultHeaders: headers
		});
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	/**
	 * Generate text completion using AI Gateway + OpenRouter
	 */
	async generateCompletion(
		messages: AIGatewayMessage[],
		config: Partial<AIGatewayConfig> = {}
	): Promise<AIGatewayResponse> {
		const finalConfig = { ...this.config, ...config };

		try {
			const completion = await this.openai.chat.completions.create({
				model: finalConfig.model,
				messages: messages.map(msg => ({
					role: msg.role,
					content: msg.content
				})),
				max_tokens: finalConfig.maxTokens,
				temperature: finalConfig.temperature,
				top_p: finalConfig.topP
			});

			const responseText = completion.choices[0]?.message?.content;
			const usage = completion.usage;

			if (typeof responseText !== 'string' || responseText.trim() === '') {
				throw new Error('AI Gateway: No message content returned from completion response.');
			}

			return {
				response: responseText,
				usage: usage ? {
					total_tokens: usage.total_tokens,
					prompt_tokens: usage.prompt_tokens,
					completion_tokens: usage.completion_tokens
				} : undefined
			};

		} catch (error) {
			throw this.handleError(error);
		}
	}

	/**
	 * Generate completion from a single prompt (convenience method)
	 */
	async generateFromPrompt(
		prompt: string,
		systemMessage?: string,
		config: Partial<AIGatewayConfig> = {}
	): Promise<AIGatewayResponse> {
		const messages: AIGatewayMessage[] = [];
		
		if (systemMessage) {
			messages.push({ role: 'system', content: systemMessage });
		}
		
		messages.push({ role: 'user', content: prompt });

		return this.generateCompletion(messages, config);
	}

	/**
	 * Get current configuration
	 */
	getConfig(): AIGatewayConfig {
		return { ...this.config };
	}

	/**
	 * Handle and standardize errors
	 */
	private handleError(error: unknown): AIGatewayError {
		console.error('AI Gateway Service Error:', error);

		if (error instanceof Error) {
			// Check for specific error types
			if (error.message.includes('rate limit') || error.message.includes('429')) {
				return {
					code: 'RATE_LIMITED',
					message: 'AI service rate limit exceeded. Please try again later.',
					details: { originalMessage: error.message }
				};
			}

			if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
				return {
					code: 'TIMEOUT',
					message: 'AI service request timed out. Please try again.',
					details: { originalMessage: error.message }
				};
			}

			if (error.message.includes('API key') || error.message.includes('unauthorized') || error.message.includes('401')) {
				return {
					code: 'UNAUTHORIZED',
					message: 'Invalid API key or unauthorized access.',
					details: { originalMessage: error.message }
				};
			}

			if (error.message.includes('quota') || error.message.includes('limit exceeded')) {
				return {
					code: 'QUOTA_EXCEEDED',
					message: 'API quota exceeded. Please check your billing.',
					details: { originalMessage: error.message }
				};
			}
		}

		// Default error
		return {
			code: 'AI_ERROR',
			message: 'An error occurred with the AI service.',
			details: error instanceof Error ? { originalMessage: error.message } : { error }
		};
	}
}

/**
 * Factory function to create AI Gateway service instance
 */
export function createAIGatewayService(
	openrouterToken: string,
	aiGatewayBaseURL: string,
	config: AIGatewayConfig,
	cfAigToken?: string
): AIGatewayService {
	return new AIGatewayService(openrouterToken, aiGatewayBaseURL, config, cfAigToken);
}
