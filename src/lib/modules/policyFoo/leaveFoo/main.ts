/**
 * Leave Policy Main Agent
 *
 * Single-stage agent that processes leave policy content and generates comprehensive responses.
 * Uses the main LLM model optimized for complex reasoning and citation generation.
 */

import { generateAICompletion } from '$lib/core/ai-gateway.service.js';
import type { AIGatewayMessage } from '$lib/core/common.types.js';
import type { PolicyMainInput, PolicyMainOutput } from '../types';
import type { PolicyFooEnvironment } from '../index';
import { MODEL_CONFIG, ERROR_MESSAGES } from '../constants';

/**
 * Generate leave policy response with citations and analysis
 *
 * @param input - Main agent input with messages, prompt, and leave policy content
 * @param env - Environment variables and bindings
 * @returns Promise with structured XML response and usage statistics
 */
export async function generateLeaveResponse(
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
		console.error('Leave main agent error:', error);

		if (error && typeof error === 'object' && 'code' in error) {
			// Re-throw PolicyFooError as-is
			throw error;
		}

		// Wrap unexpected errors
		throw {
			code: 'AI_GATEWAY_ERROR' as const,
			message: `${ERROR_MESSAGES.AI_GATEWAY_ERROR}: ${error instanceof Error ? error.message : 'Unknown leave main agent error'}`,
			details: { originalError: error }
		};
	}
}

/**
 * Build messages for the main agent
 */
function buildMainMessages(input: PolicyMainInput): AIGatewayMessage[] {
	const messages: AIGatewayMessage[] = [];

	// For leave policy, we expect only one policy document
	const leavePolicy = input.policyContent[0];

	// Add system message with main prompt and leave policy content
	const systemContent = input.mainPrompt.replace('{leave_policy_content}', leavePolicy);

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
			message: `${ERROR_MESSAGES.POLICY_NOT_FOUND}: Leave policy content is required`
		};
	}

	// Check that leave policy content is valid
	if (typeof input.policyContent[0] !== 'string' || input.policyContent[0].trim().length === 0) {
		throw {
			code: 'POLICY_NOT_FOUND' as const,
			message: `${ERROR_MESSAGES.POLICY_NOT_FOUND}: Leave policy content is empty or invalid`
		};
	}

	// Leave policy should only have one document
	if (input.policyContent.length > 1) {
		console.warn(
			`Leave policy handler received ${input.policyContent.length} documents, expected 1. Using first document.`
		);
	}
}

/**
 * Extract leave policy sections for reference
 * This is a utility function that could be used for citation validation
 */
export function extractLeavePolicySections(policyContent: string): string[] {
	const sections: string[] = [];

	// Look for section numbers in the content (e.g., "3.1", "4.2.1")
	const matches = policyContent.match(/\b\d+\.\d+(?:\.\d+)?\b/g);
	if (matches) {
		sections.push(...matches);
	}

	// Remove duplicates and return
	return [...new Set(sections)].sort();
}
