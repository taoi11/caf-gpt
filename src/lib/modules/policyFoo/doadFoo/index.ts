/**
 * DOAD Policy Handler
 *
 * Handles DOAD (Defence Administrative Orders and Directives) policy queries.
 * Implements enhanced workflow: Finder → Database → Metadata Selector → Main Agent.
 */

import type {
	PolicyQueryInput,
	PolicyQueryOutput,
	PolicyHandlerConfig,
	PolicyMessage
} from '../types';
import type { PolicyFooEnvironment } from '../index';
import { MODEL_CONFIG, PROMPT_PATHS, ERROR_MESSAGES } from '../constants';
import { findDOADPolicies } from './finder.js';
import { generateDOADResponse } from './main.js';
import { selectRelevantChunks } from './metadata-selector.js';
import {
	getDOADChunksByNumbers,
	getDOADMetadataByNumbers,
	getDOADChunksByIds,
	formatChunksForLLM
} from './database.service.js';
import { healthCheck } from '../../../core/db/client.js';

// Import prompt files directly from local codebase
import finderPromptRaw from './prompts/finder.md?raw';
import mainPromptRaw from './prompts/main.md?raw';
import policyListTableRaw from './prompts/DOAD-list-table.md?raw';

/**
 * Handle DOAD policy queries with enhanced database-driven workflow
 *
 * @param input - Query input with messages and policy set
 * @param env - Environment variables and bindings
 * @returns Promise with policy query response
 */
export async function handleDOADQuery(
	input: PolicyQueryInput,
	env: PolicyFooEnvironment
): Promise<PolicyQueryOutput> {
	const startTime = Date.now();
	let stage = 'initialization';

	try {
		// Performance monitoring and error tracking
		const performanceMetrics = {
			finder: 0,
			database_chunks: 0,
			database_metadata: 0,
			metadata_selector: 0,
			database_selected: 0,
			main_agent: 0,
			total: 0
		};

		stage = 'config_loading';
		// Load required prompts
		const config = await loadDOADConfig(env);

		stage = 'database_health_check';
		// Check database connectivity before proceeding
		const isDatabaseHealthy = await healthCheck(env.HYPERDRIVE);
		if (!isDatabaseHealthy) {
			throw new Error('Database service is currently unavailable. Please try again later.');
		}

		stage = 'finder_agent';
		const finderStart = Date.now();
		// Stage 1: Find relevant policies using Finder Agent
		const finderResult = await findDOADPolicies(
			{
				messages: input.messages,
				finderPrompt: config.prompts.finder,
				policyListTable: config.prompts.policyList
			},
			env
		);
		performanceMetrics.finder = Date.now() - finderStart;

		// If no policies found, return early response
		if (finderResult.policyNumbers.length === 0) {
			performanceMetrics.total = Date.now() - startTime;
			console.log('DOAD query completed (no policies found):', performanceMetrics);

			return {
				message: generateNoPoliciesFoundResponse(),
				usage: {
					finder: finderResult.usage,
					main: undefined
				}
			};
		}

		stage = 'database_chunks_retrieval';
		const dbChunksStart = Date.now();
		// Stage 2: Retrieve chunks from database for selected DOADs
		const allChunks = await getDOADChunksByNumbers(finderResult.policyNumbers, env.HYPERDRIVE);
		performanceMetrics.database_chunks = Date.now() - dbChunksStart;

		if (allChunks.length === 0) {
			performanceMetrics.total = Date.now() - startTime;
			console.warn('No chunks found in database for DOADs:', finderResult.policyNumbers);

			return {
				message: generateNoPoliciesFoundResponse(),
				usage: {
					finder: finderResult.usage,
					main: undefined
				}
			};
		}

		stage = 'database_metadata_retrieval';
		const dbMetadataStart = Date.now();
		// Stage 3: Get metadata for chunk selection
		const chunkMetadata = await getDOADMetadataByNumbers(
			finderResult.policyNumbers,
			env.HYPERDRIVE
		);
		performanceMetrics.database_metadata = Date.now() - dbMetadataStart;

		// Extract user query from messages
		const userQuery = extractUserQuery(input.messages);

		stage = 'metadata_selector';
		const selectorStart = Date.now();
		// Stage 4: Select relevant chunks using Metadata Selector Agent
		const selectorResult = await selectRelevantChunks(
			{
				userQuery,
				doadMetadata: chunkMetadata
			},
			env
		);
		performanceMetrics.metadata_selector = Date.now() - selectorStart;

		stage = 'database_selected_retrieval';
		const dbSelectedStart = Date.now();
		// Stage 5: Retrieve full content for selected chunks
		const selectedChunks = await getDOADChunksByIds(
			selectorResult.selectedChunkIds,
			env.HYPERDRIVE
		);
		performanceMetrics.database_selected = Date.now() - dbSelectedStart;

		if (selectedChunks.length === 0) {
			performanceMetrics.total = Date.now() - startTime;
			console.warn(
				'No chunks selected by metadata selector for query:',
				userQuery.substring(0, 100)
			);

			return {
				message: generateNoPoliciesFoundResponse(),
				usage: {
					finder: finderResult.usage,
					main: undefined
				}
			};
		}

		stage = 'main_agent';
		const mainStart = Date.now();
		// Stage 6: Generate response using Main Agent with selected chunks
		const formattedContent = formatChunksForLLM(selectedChunks);

		const mainResult = await generateDOADResponse(
			{
				messages: input.messages,
				mainPrompt: config.prompts.main,
				policyContent: [formattedContent] // Convert to array format expected by main agent
			},
			env
		);
		performanceMetrics.main_agent = Date.now() - mainStart;

		performanceMetrics.total = Date.now() - startTime;

		// Log comprehensive performance metrics
		console.log('DOAD query completed successfully:', {
			...performanceMetrics,
			found_doads: finderResult.policyNumbers.length,
			total_chunks: allChunks.length,
			selected_chunks: selectedChunks.length,
			selection_ratio: `${selectedChunks.length}/${allChunks.length}`
		});

		return {
			message: mainResult.response,
			usage: {
				finder: finderResult.usage,
				main: mainResult.usage
			}
		};
	} catch (error) {
		const totalTime = Date.now() - startTime;
		console.error(`DOAD handler error at stage '${stage}' after ${totalTime}ms:`, error);

		if (error && typeof error === 'object' && 'code' in error) {
			// Re-throw PolicyFooError as-is
			throw error;
		}

		// Wrap unexpected errors with stage context
		throw {
			code: 'GENERAL_ERROR' as const,
			message: `${ERROR_MESSAGES.GENERAL_ERROR} at stage '${stage}': ${error instanceof Error ? error.message : 'Unknown DOAD handler error'}`,
			details: {
				originalError: error,
				stage,
				duration: totalTime
			}
		};
	}
}

/**
 * Load DOAD configuration including prompts
 */
async function loadDOADConfig(env: PolicyFooEnvironment): Promise<PolicyHandlerConfig> {
	try {
		// Use imported prompt files from local codebase
		return {
			readerModel: env.READER_MODEL || MODEL_CONFIG.READER_MODEL,
			mainModel: env.MAIN_MODEL || MODEL_CONFIG.MAIN_MODEL,
			prompts: {
				finder: finderPromptRaw,
				main: mainPromptRaw,
				policyList: policyListTableRaw
			}
		};
	} catch (error) {
		console.error('DOAD config loading error:', error);

		if (error && typeof error === 'object' && 'code' in error) {
			throw error;
		}

		throw {
			code: 'PROMPT_NOT_FOUND' as const,
			message: `${ERROR_MESSAGES.PROMPT_NOT_FOUND}: ${error instanceof Error ? error.message : 'Unknown prompt loading error'}`,
			details: { originalError: error }
		};
	}
}

/**
 * Extract user query from conversation messages
 */
function extractUserQuery(messages: PolicyMessage[]): string {
	// Find the last user message as the current query
	const userMessages = messages.filter((msg) => msg.role === 'user');
	return userMessages.length > 0 ? userMessages[userMessages.length - 1].content : '';
}

/**
 * Generate response when no policies are found
 */
function generateNoPoliciesFoundResponse(): string {
	return `<response>
<answer>I couldn't find any specific DOAD policies that directly address your question. This could mean:

1. Your question might relate to policies not yet digitized or available in my database
2. The question might be addressed by general military procedures rather than specific DOAD policies
3. The topic might fall under a different type of directive or instruction

Could you please:
- Rephrase your question with more specific keywords
- Mention if you know of any specific DOAD numbers that might be relevant
- Provide additional context about what you're trying to accomplish</answer>
<citations>
</citations>
<follow_up>Could you provide more specific details about what you're looking for, or mention any DOAD numbers you think might be relevant?</follow_up>
</response>`;
}
