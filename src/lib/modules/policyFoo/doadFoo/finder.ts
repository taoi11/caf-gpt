/**
 * DOAD Policy Finder Agent
 *
 * Stage 1 agent that identifies relevant DOAD policy numbers from user queries.
 * Uses a lighter LLM model optimized for policy identification tasks.
 */

import { generateAICompletion, type AIGatewayMessage } from '$lib/server/ai-gateway.service.js';
import type { PolicyFinderInput, PolicyFinderOutput } from '../types';
import type { PolicyFooEnvironment } from '../index';
import { MODEL_CONFIG, ERROR_MESSAGES } from '../constants';
import { parsePolicyNumbers } from '$lib/server/r2.util';

/**
 * Find relevant DOAD policies for a user query
 *
 * @param input - Finder input with messages and prompts
 * @param env - Environment variables and bindings
 * @returns Promise with found policy numbers and usage statistics
 */
export async function findDOADPolicies(
	input: PolicyFinderInput,
	env: PolicyFooEnvironment
): Promise<PolicyFinderOutput> {
	try {
		// Build messages for finder agent
		const messages = buildFinderMessages(input);

		// Get response from AI Gateway using reader model
		const response = await generateAICompletion(
			messages,
			env.READER_MODEL || MODEL_CONFIG.READER_MODEL,
			env
		);

		// Parse policy numbers from response
		const policyNumbers = parsePolicyNumbers(response.response);

		return {
			policyNumbers,
			usage: response.usage
		};
	} catch (error) {
		console.error('DOAD finder error:', error);

		if (error && typeof error === 'object' && 'code' in error) {
			// Re-throw PolicyFooError as-is
			throw error;
		}

		// Wrap unexpected errors
		throw {
			code: 'AI_GATEWAY_ERROR' as const,
			message: `${ERROR_MESSAGES.AI_GATEWAY_ERROR}: ${error instanceof Error ? error.message : 'Unknown finder error'}`,
			details: { originalError: error }
		};
	}
}

/**
 * Build messages for the finder agent
 */
function buildFinderMessages(input: PolicyFinderInput): AIGatewayMessage[] {
	const messages: AIGatewayMessage[] = [];

	// Add system message with finder prompt and policy list
	const systemContent = `${input.finderPrompt}

Available DOAD Policies:
${input.policyListTable}`;

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
 * Validate finder input
 */
function validateFinderInput(input: PolicyFinderInput): void {
	if (!input.messages || input.messages.length === 0) {
		throw {
			code: 'INVALID_MESSAGES' as const,
			message: `${ERROR_MESSAGES.INVALID_MESSAGES}: Messages cannot be empty`
		};
	}

	if (!input.finderPrompt || input.finderPrompt.trim().length === 0) {
		throw {
			code: 'PROMPT_NOT_FOUND' as const,
			message: `${ERROR_MESSAGES.PROMPT_NOT_FOUND}: Finder prompt is required`
		};
	}

	if (!input.policyListTable || input.policyListTable.trim().length === 0) {
		throw {
			code: 'PROMPT_NOT_FOUND' as const,
			message: `${ERROR_MESSAGES.PROMPT_NOT_FOUND}: Policy list table is required`
		};
	}
}
