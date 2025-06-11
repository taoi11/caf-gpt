import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { createWorkersAIService } from '$lib/server/services/workers-ai.service.js';

export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		// Validate AI binding is available
		if (!platform?.env?.AI) {
			return json(
				{ error: 'AI service is not available' },
				{ status: 500 }
			);
		}

		// Parse request body
		const { prompt, systemMessage, config } = await request.json();
		
		if (!prompt || typeof prompt !== 'string') {
			return json(
				{ error: 'Prompt is required and must be a string' },
				{ status: 400 }
			);
		}

		// Create AI service instance
		const aiService = createWorkersAIService(platform.env.AI, config);

		// Generate response
		const result = await aiService.generateFromPrompt(
			prompt,
			systemMessage,
			config
		);

		return json({
			success: true,
			data: {
				response: result.response,
				usage: result.usage,
				cost: result.cost,
				model: aiService.getConfig().model
			}
		});

	} catch (error) {
		console.error('AI generation error:', error);
		
		// Handle WorkersAI errors
		if (error && typeof error === 'object' && 'code' in error) {
			const aiError = error as any;
			return json(
				{ 
					error: aiError.message,
					code: aiError.code
				},
				{ status: aiError.code === 'RATE_LIMITED' ? 429 : 500 }
			);
		}

		return json(
			{ error: 'An unexpected error occurred' },
			{ status: 500 }
		);
	}
};
