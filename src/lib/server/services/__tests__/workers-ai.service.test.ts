import { describe, test, expect, vi, beforeEach } from 'vitest';
import { WorkersAIService, type WorkersAIMessage } from '../workers-ai.service.js';

// Mock AI binding
const mockAI = {
	run: vi.fn()
};

describe('WorkersAIService', () => {
	let service: WorkersAIService;

	beforeEach(() => {
		vi.clearAllMocks();
		service = new WorkersAIService(mockAI as any);
	});

	describe('generateCompletion', () => {
		test('should generate completion with default config', async () => {
			const mockResponse = {
				response: 'Hello, how can I help you today?'
			};
			mockAI.run.mockResolvedValue(mockResponse);

			const messages: WorkersAIMessage[] = [
				{ role: 'user', content: 'Hello' }
			];

			const result = await service.generateCompletion(messages);

			expect(mockAI.run).toHaveBeenCalledWith(
				'@cf/meta/llama-3.1-8b-instruct',
				expect.objectContaining({
					messages: [{ role: 'user', content: 'Hello' }],
					max_tokens: 1000,
					temperature: 0.7,
					top_p: 0.9,
					stream: false
				})
			);

			expect(result).toEqual({
				response: 'Hello, how can I help you today?',
				usage: {
					total_tokens: expect.any(Number),
					prompt_tokens: expect.any(Number),
					completion_tokens: expect.any(Number)
				},
				cost: expect.any(Number)
			});
		});

		test('should handle custom configuration', async () => {
			const mockResponse = {
				response: 'Custom response'
			};
			mockAI.run.mockResolvedValue(mockResponse);

			const messages: WorkersAIMessage[] = [
				{ role: 'system', content: 'You are a helpful assistant' },
				{ role: 'user', content: 'Help me' }
			];

			const customConfig = {
				model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' as const,
				maxTokens: 500,
				temperature: 0.5
			};

			const result = await service.generateCompletion(messages, customConfig);

			expect(mockAI.run).toHaveBeenCalledWith(
				'@cf/meta/llama-3.3-70b-instruct-fp8-fast',
				expect.objectContaining({
					max_tokens: 500,
					temperature: 0.5
				})
			);

			expect(result.response).toBe('Custom response');
		});

		test('should handle AI service errors', async () => {
			mockAI.run.mockRejectedValue(new Error('Rate limit exceeded'));

			const messages: WorkersAIMessage[] = [
				{ role: 'user', content: 'Hello' }
			];

			await expect(service.generateCompletion(messages)).rejects.toEqual({
				code: 'RATE_LIMITED',
				message: 'AI service rate limit exceeded. Please try again later.',
				details: { originalMessage: 'Rate limit exceeded' }
			});
		});
	});

	describe('generateFromPrompt', () => {
		test('should generate completion from prompt', async () => {
			const mockResponse = {
				response: 'Prompt response'
			};
			mockAI.run.mockResolvedValue(mockResponse);

			const result = await service.generateFromPrompt('What is AI?');

			expect(mockAI.run).toHaveBeenCalledWith(
				'@cf/meta/llama-3.1-8b-instruct',
				expect.objectContaining({
					messages: [{ role: 'user', content: 'What is AI?' }]
				})
			);

			expect(result.response).toBe('Prompt response');
		});

		test('should include system message when provided', async () => {
			const mockResponse = {
				response: 'System response'
			};
			mockAI.run.mockResolvedValue(mockResponse);

			await service.generateFromPrompt(
				'What is AI?',
				'You are an AI expert'
			);

			expect(mockAI.run).toHaveBeenCalledWith(
				'@cf/meta/llama-3.1-8b-instruct',
				expect.objectContaining({
					messages: [
						{ role: 'system', content: 'You are an AI expert' },
						{ role: 'user', content: 'What is AI?' }
					]
				})
			);
		});
	});

	describe('getAvailableModels', () => {
		test('should return list of available models', () => {
			const models = service.getAvailableModels();

			expect(models).toHaveLength(4);
			expect(models[0]).toEqual({
				id: '@cf/meta/llama-3.1-8b-instruct',
				name: 'Llama 3.1 8B Instruct',
				cost: 0.00015
			});
		});
	});

	describe('configuration management', () => {
		test('should update configuration', () => {
			const newConfig = {
				model: '@cf/qwen/qwq-32b' as const,
				temperature: 0.8
			};

			service.updateConfig(newConfig);
			const config = service.getConfig();

			expect(config.model).toBe('@cf/qwen/qwq-32b');
			expect(config.temperature).toBe(0.8);
			expect(config.maxTokens).toBe(1000); // Should preserve other defaults
		});
	});

	describe('error handling', () => {
		test('should handle model not found error', async () => {
			mockAI.run.mockRejectedValue(new Error('model not found'));

			const messages: WorkersAIMessage[] = [
				{ role: 'user', content: 'Hello' }
			];

			await expect(service.generateCompletion(messages)).rejects.toEqual({
				code: 'MODEL_NOT_FOUND',
				message: 'The requested AI model is not available.',
				details: { originalMessage: 'model not found' }
			});
		});

		test('should handle timeout error', async () => {
			mockAI.run.mockRejectedValue(new Error('Request timeout'));

			const messages: WorkersAIMessage[] = [
				{ role: 'user', content: 'Hello' }
			];

			await expect(service.generateCompletion(messages)).rejects.toEqual({
				code: 'TIMEOUT',
				message: 'AI service request timed out. Please try again.',
				details: { originalMessage: 'Request timeout' }
			});
		});

		test('should handle unknown errors', async () => {
			mockAI.run.mockRejectedValue(new Error('Unknown error'));

			const messages: WorkersAIMessage[] = [
				{ role: 'user', content: 'Hello' }
			];

			await expect(service.generateCompletion(messages)).rejects.toEqual({
				code: 'AI_ERROR',
				message: 'An error occurred with the AI service.',
				details: { originalMessage: 'Unknown error' }
			});
		});
	});
});
