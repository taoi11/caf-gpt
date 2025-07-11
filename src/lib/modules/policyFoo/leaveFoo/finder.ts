/**
 * Leave Policy Finder Agent
 *
 * Single-stage agent that identifies relevant leave policy chapters from user queries.
 * Uses a lighter LLM model optimized for chapter identification tasks.
 */

import type { LeaveFinderInput, LeaveFinderOutput } from './types';
import type { PolicyAIGatewayMessage } from '../types';
import type { PolicyFooEnvironment } from '../index';
import { MODEL_CONFIG, ERROR_MESSAGES } from '../constants';
import { createPolicyAIGatewayService } from '../ai-gateway.util';

/**
 * Find relevant leave policy chapters for a user query
 *
 * @param input - Finder input with messages and prompts
 * @param env - Environment variables and bindings
 * @returns Promise with found chapters and usage statistics
 */
export async function findLeaveChapters(
	input: LeaveFinderInput,
	env: PolicyFooEnvironment
): Promise<LeaveFinderOutput> {
	validateFinderInput(input);
	try {
		// Create AI Gateway service for finder agent
		const aiService = createPolicyAIGatewayService(
			env.OPENROUTER_TOKEN,
			env.AI_GATEWAY_BASE_URL,
			env.CF_AIG_TOKEN,
			env.READER_MODEL || MODEL_CONFIG.READER_MODEL
		);

		// Build messages for finder agent
		const messages = buildFinderMessages(input);

		// Get response from AI Gateway
		const response = await aiService.generateCompletion(messages);

		// Parse chapter numbers from response
		const chapters = parseChapterNumbers(response.response);

		return {
			chapters,
			usage: response.usage
		};
	} catch (error) {
		console.error('Leave finder error:', error);

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
function buildFinderMessages(input: LeaveFinderInput): PolicyAIGatewayMessage[] {
	const messages: PolicyAIGatewayMessage[] = [];

	// Add system message with finder prompt and chapter list
	const systemContent = `${input.finderPrompt}

Available Leave Policy Chapters:
${input.chapterList}`;

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
 * Parse chapter numbers from AI response
 * Extracts chapter identifiers like "0", "1", "2", etc.
 */
function parseChapterNumbers(response: string): string[] {
	// Look for chapter patterns in the response
	const chapterPatterns = [
		/Chapter\s+(\d+)/gi,
		/chapter\s*:?\s*(\d+)/gi,
		/^\s*(\d+)\s*$/gm,
		/\b(\d+)\b/g
	];

	const foundChapters = new Set<string>();

	for (const pattern of chapterPatterns) {
		const matches = response.matchAll(pattern);
		for (const match of matches) {
			const chapterNum = match[1]?.trim();
			if (chapterNum && chapterNum.length <= 2) {
				// Only accept single or double digit chapter numbers
				foundChapters.add(chapterNum);
			}
		}
	}

	// Convert to array and sort
	const chapters = Array.from(foundChapters).sort((a, b) => parseInt(a) - parseInt(b));

	// If no chapters found, default to Chapter 0 (general information)
	if (chapters.length === 0) {
		return ['0'];
	}

	return chapters;
}

/**
 * Validate finder input
 */
function validateFinderInput(input: LeaveFinderInput): void {
	if (!input.messages || input.messages.length === 0) {
		throw {
			code: 'INVALID_MESSAGES' as const,
			message: ERROR_MESSAGES.INVALID_MESSAGES,
			details: { received: input.messages }
		};
	}

	if (!input.finderPrompt || input.finderPrompt.trim().length === 0) {
		throw {
			code: 'PROMPT_NOT_FOUND' as const,
			message: ERROR_MESSAGES.PROMPT_NOT_FOUND,
			details: { promptType: 'finder', received: input.finderPrompt }
		};
	}

	if (!input.chapterList || input.chapterList.trim().length === 0) {
		throw {
			code: 'POLICY_NOT_FOUND' as const,
			message: ERROR_MESSAGES.POLICY_NOT_FOUND,
			details: { contentType: 'chapter_list', received: input.chapterList }
		};
	}
}
