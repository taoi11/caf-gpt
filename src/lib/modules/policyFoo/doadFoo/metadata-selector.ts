/**
 * DOAD Metadata Selector Agent
 *
 * Second-phase LLM agent that selects relevant chunks based on metadata analysis.
 * Uses lightweight model for efficient chunk selection from database results.
 */

import { createAIGatewayService, type AIGatewayMessage } from '$lib/server/ai-gateway.service.js';
import type { PolicyFooEnvironment } from '../index';
import type { MetadataSelectorInput, MetadataSelectorOutput, DOADMetadata } from './types';
import { MODEL_CONFIG, ERROR_MESSAGES } from '../constants';

// Import prompt file directly from local codebase
import metadataSelectorPromptRaw from './prompts/metadata-selector.md?raw';

/**
 * Select relevant chunks based on metadata analysis
 *
 * @param input - Metadata selector input with user query and metadata
 * @param env - Environment variables and bindings
 * @returns Promise with selected chunk IDs and usage statistics
 */
export async function selectRelevantChunks(
	input: MetadataSelectorInput,
	env: PolicyFooEnvironment
): Promise<MetadataSelectorOutput> {
	try {
		// Validate input
		if (!input.doadMetadata || input.doadMetadata.length === 0) {
			console.warn('No metadata provided for chunk selection');
			return { selectedChunkIds: [], usage: undefined };
		}

		// Create AI Gateway service for metadata selector
		const aiGateway = createAIGatewayService(
			env.OPENROUTER_TOKEN!,
			env.AI_GATEWAY_BASE_URL!,
			{
				model: env.READER_MODEL || MODEL_CONFIG.READER_MODEL,
				temperature: 0.1
			},
			env.CF_AIG_TOKEN!
		);

		// Optimize metadata serialization for LLM processing
		const optimizedMetadata = optimizeMetadataForLLM(input.doadMetadata);
		const metadataJson = JSON.stringify(optimizedMetadata, null, 2);

		// Truncate very long queries to prevent token overflow
		const truncatedQuery =
			input.userQuery.length > 500 ? input.userQuery.substring(0, 500) + '...' : input.userQuery;

		// Build messages for metadata selector
		const messages: AIGatewayMessage[] = [
			{
				role: 'system',
				content: metadataSelectorPromptRaw
			},
			{
				role: 'user',
				content: `User Query: ${truncatedQuery}\n\nChunk Metadata (${optimizedMetadata.length} chunks):\n${metadataJson}`
			}
		];

		// Log performance metrics
		const startTime = Date.now();

		// Call AI Gateway with READER_MODEL (lightweight, efficient)
		const response = await aiGateway.generateCompletion(messages);

		const duration = Date.now() - startTime;
		console.log(
			`Metadata selection completed in ${duration}ms for ${input.doadMetadata.length} chunks`
		);

		// Parse chunk IDs from response with validation
		const selectedChunkIds = parseAndValidateChunkIds(
			response.response,
			input.doadMetadata.map((m) => m.id)
		);

		// Log selection metrics for monitoring
		console.log(
			`Selected ${selectedChunkIds.length}/${input.doadMetadata.length} chunks for query`
		);

		return {
			selectedChunkIds,
			usage: response.usage
		};
	} catch (error) {
		console.error('Metadata selector error:', error);

		if (error && typeof error === 'object' && 'code' in error) {
			throw error;
		}

		throw {
			code: 'AI_GATEWAY_ERROR' as const,
			message: `${ERROR_MESSAGES.AI_GATEWAY_ERROR}: ${error instanceof Error ? error.message : 'Unknown metadata selector error'}`,
			details: { originalError: error }
		};
	}
}

/**
 * Parse and validate chunk IDs from metadata selector response
 * Ensures all returned IDs are valid and exist in the available chunks
 */
function parseAndValidateChunkIds(response: string, availableIds: string[]): string[] {
	try {
		// Remove any XML tags and extract clean chunk IDs
		const cleanResponse = response
			.replace(/<[^>]*>/g, '') // Remove XML tags
			.trim();

		// Split by commas and clean up each ID
		const parsedIds = cleanResponse
			.split(',')
			.map((id) => id.trim())
			.filter((id) => id.length > 0 && isValidUUID(id));

		// Validate that all IDs exist in available chunks
		const validIds = parsedIds.filter((id) => availableIds.includes(id));

		// Log validation results
		if (parsedIds.length !== validIds.length) {
			console.warn(
				`Filtered ${parsedIds.length - validIds.length} invalid chunk IDs from response`
			);
		}

		return validIds;
	} catch (error) {
		console.warn('Failed to parse chunk IDs from response:', response);
		return [];
	}
}

/**
 * Optimize metadata for LLM processing
 * Reduces payload size while maintaining important context
 */
function optimizeMetadataForLLM(metadata: DOADMetadata[]): Array<{
	id: string;
	summary: string;
	doad_number?: string;
	section?: string;
	topic?: string;
	keywords?: string[];
}> {
	return metadata.map((item) => {
		const meta = item.metadata || {};

		// Create optimized summary for LLM
		const summary = [
			meta.doad_number && `DOAD ${meta.doad_number}`,
			meta.section && `Section: ${meta.section}`,
			meta.topic && `Topic: ${meta.topic}`,
			meta.content_type && `Type: ${meta.content_type}`
		]
			.filter(Boolean)
			.join(' | ');

		return {
			id: item.id,
			summary: summary || 'Policy content',
			doad_number: meta.doad_number,
			section: meta.section,
			topic: meta.topic,
			keywords: Array.isArray(meta.keywords) ? meta.keywords : undefined
		};
	});
}

/**
 * Validate UUID format (unchanged but included for completeness)
 */
function isValidUUID(str: string): boolean {
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
	return uuidRegex.test(str);
}
