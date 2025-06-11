/**
 * Workers AI Service
 * 
 * Handles LLM interactions using Cloudflare Workers AI platform.
 * Provides text generation, cost tracking, and error handling.
 */

// Basic types for Workers AI - independent of generated configuration
interface AiTextGenerationInput {
	messages?: Array<{ role: string; content: string }>;
	prompt?: string;
	max_tokens?: number;
	temperature?: number;
	top_p?: number;
	stream?: boolean;
}

interface AiTextGenerationOutput {
	response?: string;
}

// Define supported models as string literals
type SupportedModel = 
	| '@cf/meta/llama-3.1-8b-instruct'
	| '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
	| '@cf/qwen/qwq-32b'
	| '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b';

export interface WorkersAIConfig {
	model: SupportedModel;
	maxTokens?: number;
	temperature?: number;
	topP?: number;
	stream?: boolean;
}

export interface WorkersAIMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

export interface WorkersAIResponse {
	response: string;
	usage?: {
		prompt_tokens?: number;
		completion_tokens?: number;
		total_tokens?: number;
	};
	cost?: number; // Cost in USD (calculated from tokens)
}

export interface WorkersAIError {
	code: string;
	message: string;
	details?: Record<string, unknown>;
}

/**
 * Default configuration for Workers AI
 */
const DEFAULT_CONFIG: WorkersAIConfig = {
	model: '@cf/meta/llama-3.1-8b-instruct',
	maxTokens: 1000,
	temperature: 0.7,
	topP: 0.9,
	stream: false
};

/**
 * Approximate cost per 1000 tokens in USD for various models
 * Based on Cloudflare's pricing: https://developers.cloudflare.com/workers-ai/platform/pricing/
 */
const MODEL_COSTS: Record<string, number> = {
	'@cf/meta/llama-3.1-8b-instruct': 0.00015, // $0.15 per 1M tokens
	'@cf/meta/llama-3.3-70b-instruct-fp8-fast': 0.0008, // $0.80 per 1M tokens
	'@cf/qwen/qwq-32b': 0.0004, // $0.40 per 1M tokens
	'@cf/deepseek-ai/deepseek-r1-distill-qwen-32b': 0.0004 // $0.40 per 1M tokens
};

export class WorkersAIService {
	private ai: any; // Using any for now until proper types are available
	private config: WorkersAIConfig;

	constructor(ai: any, config: Partial<WorkersAIConfig> = {}) {
		this.ai = ai;
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	/**
	 * Generate text completion using Workers AI
	 */
	async generateCompletion(
		messages: WorkersAIMessage[],
		config: Partial<WorkersAIConfig> = {}
	): Promise<WorkersAIResponse> {
		const finalConfig = { ...this.config, ...config };

		try {
			// Prepare the input for Workers AI
			const input: AiTextGenerationInput = {
				messages: messages.map(msg => ({
					role: msg.role,
					content: msg.content
				})),
				max_tokens: finalConfig.maxTokens,
				temperature: finalConfig.temperature,
				top_p: finalConfig.topP,
				stream: finalConfig.stream
			};

			// Call Workers AI
			const response = await this.ai.run(finalConfig.model, input) as AiTextGenerationOutput;

			// Handle streaming vs non-streaming response
			if (response instanceof ReadableStream) {
				throw new Error('Streaming responses not yet implemented');
			}

			// Extract response text
			const responseText = typeof response === 'string' ? response : response.response || '';

			// Calculate approximate cost
			const totalTokens = this.estimateTokens(messages, responseText);
			const cost = this.calculateCost(finalConfig.model, totalTokens);

			return {
				response: responseText,
				usage: {
					total_tokens: totalTokens,
					prompt_tokens: this.estimateTokens(messages),
					completion_tokens: this.estimateTokens([{ role: 'assistant', content: responseText }])
				},
				cost
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
		config: Partial<WorkersAIConfig> = {}
	): Promise<WorkersAIResponse> {
		const messages: WorkersAIMessage[] = [];
		
		if (systemMessage) {
			messages.push({ role: 'system', content: systemMessage });
		}
		
		messages.push({ role: 'user', content: prompt });

		return this.generateCompletion(messages, config);
	}

	/**
	 * Estimate token count for messages or text
	 * This is a rough approximation: 1 token ≈ 4 characters for English text
	 */
	private estimateTokens(input: WorkersAIMessage[] | string): number {
		if (typeof input === 'string') {
			return Math.ceil(input.length / 4);
		}
		
		const totalText = input.map(msg => msg.content).join(' ');
		return Math.ceil(totalText.length / 4);
	}

	/**
	 * Calculate approximate cost based on token usage
	 */
	private calculateCost(model: SupportedModel, tokens: number): number {
		const costPer1000 = MODEL_COSTS[model as string] || MODEL_COSTS['@cf/meta/llama-3.1-8b-instruct'];
		return (tokens / 1000) * costPer1000;
	}

	/**
	 * Handle and format errors from Workers AI
	 */
	private handleError(error: unknown): WorkersAIError {
		if (error instanceof Error) {
			// Check for specific Workers AI error patterns
			if (error.message.includes('rate limit') || error.message.includes('Rate limit')) {
				return {
					code: 'RATE_LIMITED',
					message: 'AI service rate limit exceeded. Please try again later.',
					details: { originalMessage: error.message }
				};
			}

			if (error.message.includes('model not found')) {
				return {
					code: 'MODEL_NOT_FOUND',
					message: 'The requested AI model is not available.',
					details: { originalMessage: error.message }
				};
			}

			if (error.message.includes('timeout')) {
				return {
					code: 'TIMEOUT',
					message: 'AI service request timed out. Please try again.',
					details: { originalMessage: error.message }
				};
			}

			return {
				code: 'AI_ERROR',
				message: 'An error occurred with the AI service.',
				details: { originalMessage: error.message }
			};
		}

		return {
			code: 'UNKNOWN_ERROR',
			message: 'An unknown error occurred.',
			details: { error }
		};
	}

	/**
	 * List available models
	 */
	getAvailableModels(): Array<{ id: SupportedModel; name: string; cost: number }> {
		return [
			{
				id: '@cf/meta/llama-3.1-8b-instruct',
				name: 'Llama 3.1 8B Instruct',
				cost: MODEL_COSTS['@cf/meta/llama-3.1-8b-instruct']
			},
			{
				id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
				name: 'Llama 3.3 70B Instruct (Fast)',
				cost: MODEL_COSTS['@cf/meta/llama-3.3-70b-instruct-fp8-fast']
			},
			{
				id: '@cf/qwen/qwq-32b',
				name: 'Qwen QwQ 32B',
				cost: MODEL_COSTS['@cf/qwen/qwq-32b']
			},
			{
				id: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
				name: 'DeepSeek R1 Distill 32B',
				cost: MODEL_COSTS['@cf/deepseek-ai/deepseek-r1-distill-qwen-32b']
			}
		];
	}

	/**
	 * Update service configuration
	 */
	updateConfig(newConfig: Partial<WorkersAIConfig>): void {
		this.config = { ...this.config, ...newConfig };
	}

	/**
	 * Get current configuration
	 */
	getConfig(): WorkersAIConfig {
		return { ...this.config };
	}
}

/**
 * Factory function to create WorkersAIService instance
 */
export function createWorkersAIService(
	ai: any, 
	config: Partial<WorkersAIConfig> = {}
): WorkersAIService {
	return new WorkersAIService(ai, config);
}
