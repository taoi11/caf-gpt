/**
 * DOAD Policy Main Agent
 *
 * Stage 2 agent that synthesizes policy content and generates comprehensive responses.
 * Uses a more capable LLM model optimized for complex reasoning and citation generation.
 */

import { generateAICompletion, type AIGatewayMessage } from '$lib/core/ai-gateway.service.js';
import type { PolicyMainInput, PolicyMainOutput } from '../types';
import type { PolicyFooEnvironment } from '../index';
import { MODEL_CONFIG, ERROR_MESSAGES } from '../constants';

/**
 * Generate DOAD policy response with citations and analysis
 *
 * @param input - Main agent input with messages, prompt, and policy content
 * @param env - Environment variables and bindings
 * @returns Promise with structured XML response and usage statistics
 */
export async function generateDOADResponse(
	input: PolicyMainInput,
	env: PolicyFooEnvironment
): Promise<PolicyMainOutput> {
	try {
		// Validate input
		validateMainInput(input);

		// Build messages for main agent
		const messages = buildMainMessages(input);

		// Get response from AI Gateway using main model
		const response = await generateAICompletion(
			messages,
			env.MAIN_MODEL || MODEL_CONFIG.MAIN_MODEL,
			env
		);

		return {
			response: response.response,
			usage: response.usage
		};
	} catch (error) {
		console.error('DOAD main agent error:', error);

		if (error && typeof error === 'object' && 'code' in error) {
			// Re-throw PolicyFooError as-is
			throw error;
		}

		// Wrap unexpected errors
		throw {
			code: 'AI_GATEWAY_ERROR' as const,
			message: `${ERROR_MESSAGES.AI_GATEWAY_ERROR}: ${error instanceof Error ? error.message : 'Unknown main agent error'}`,
			details: { originalError: error }
		};
	}
}

/**
 * Build messages for the main agent
 */
function buildMainMessages(input: PolicyMainInput): AIGatewayMessage[] {
	const messages: AIGatewayMessage[] = [];

	// Combine policy content into a single reference document
	const policyReference = input.policyContent
		.map((content, index) => `=== POLICY DOCUMENT ${index + 1} ===\n${content}`)
		.join('\n\n');

	// Add system message with main prompt and policy content
	const systemContent = `${input.mainPrompt}

RELEVANT POLICY DOCUMENTS:
${policyReference}`;

	messages.push({
		role: 'system',
		content: systemContent
	});

	// Add conversation history
	for (const message of input.messages) {
		if (message.role === 'user' || message.role === 'assistant') {
			messages.push({
				role: message.role,
				content: message.content
			});
		}
	}

	return messages;
}

/**
 * Validate main agent input
 */
function validateMainInput(input: PolicyMainInput): void {
	if (!input.messages || input.messages.length === 0) {
		throw {
			code: 'INVALID_MESSAGES' as const,
			message: `${ERROR_MESSAGES.INVALID_MESSAGES}: Messages cannot be empty`
		};
	}

	if (!input.mainPrompt || input.mainPrompt.trim().length === 0) {
		throw {
			code: 'PROMPT_NOT_FOUND' as const,
			message: `${ERROR_MESSAGES.PROMPT_NOT_FOUND}: Main prompt is required`
		};
	}

	if (!Array.isArray(input.policyContent) || input.policyContent.length === 0) {
		throw {
			code: 'POLICY_NOT_FOUND' as const,
			message: `${ERROR_MESSAGES.POLICY_NOT_FOUND}: Policy content is required`
		};
	}

	// Check that all policy content is valid
	for (let i = 0; i < input.policyContent.length; i++) {
		if (typeof input.policyContent[i] !== 'string' || input.policyContent[i].trim().length === 0) {
			throw {
				code: 'POLICY_NOT_FOUND' as const,
				message: `${ERROR_MESSAGES.POLICY_NOT_FOUND}: Policy content at index ${i} is empty or invalid`
			};
		}
	}
}

/**
 * Extract citations from policy content for reference
 * This is a utility function that could be used for citation validation
 */
export function extractPolicyCitations(policyContent: string[]): string[] {
	const citations: string[] = [];

	for (const content of policyContent) {
		// Look for DOAD numbers in the content (e.g., DOAD 5017-1)
		const matches = content.match(/DOAD\s+\d{4}-\d+/gi);
		if (matches) {
			citations.push(...matches);
		}
	}

	// Remove duplicates and return
	return [...new Set(citations)];
}
