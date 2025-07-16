/**
 * Leave Policy Handler
 *
 * Handles CAF Leave policy queries with database-driven single-stage workflow.
 * Uses finder agent to identify relevant chapters, then retrieves from database.
 */

import type { PolicyQueryInput, PolicyQueryOutput, PolicyHandlerConfig } from '../types';
import type { PolicyFooEnvironment } from '../index';
import { MODEL_CONFIG, ERROR_MESSAGES } from '../constants';
import { generateLeaveResponse } from './main.js';
import { findLeaveChapters } from './finder.js';
import { 
	getLeaveChunksByChapters, 
	getAvailableChapters, 
	formatChunksForLLM 
} from './database.service.js';

// Import prompt files directly from local codebase
import mainPromptRaw from './prompts/main.md?raw';
import finderPromptRaw from './prompts/finder.md?raw';

/**
 * Handle leave policy queries with database-driven workflow
 *
 * @param input - Query input with messages and policy set
 * @param env - Environment variables and bindings
 * @returns Promise with policy query response
 */
export async function handleLeaveQuery(
	input: PolicyQueryInput,
	env: PolicyFooEnvironment
): Promise<PolicyQueryOutput> {
	const startTime = Date.now();
	let stage = 'initialization';

	try {
		// Performance monitoring
		const performanceMetrics = {
			finder: 0,
			database: 0,
			main_agent: 0,
			total: 0
		};

		stage = 'config_loading';
		// Load required configuration
		const config = await loadLeaveConfig(env);

		stage = 'finder_agent';
		const finderStart = Date.now();
		// Stage 1: Find relevant chapters using Finder Agent
		const finderResult = await findLeaveChapters(
			{
				messages: input.messages,
				finderPrompt: config.prompts.finder,
				chapterList: config.chapterList
			},
			env
		);
		performanceMetrics.finder = Date.now() - finderStart;

		// If no chapters found, return early response
		if (finderResult.chapters.length === 0) {
			performanceMetrics.total = Date.now() - startTime;
			console.log('Leave query completed (no chapters found):', performanceMetrics);

			return {
				message: generateNoChaptersFoundResponse(),
				usage: {
					finder: finderResult.usage,
					main: undefined
				}
			};
		}

		stage = 'database_retrieval';
		const dbStart = Date.now();
		// Stage 2: Retrieve chunks from database for selected chapters
		const chunks = await getLeaveChunksByChapters(finderResult.chapters);
		performanceMetrics.database = Date.now() - dbStart;

		if (chunks.length === 0) {
			performanceMetrics.total = Date.now() - startTime;
			console.warn('No chunks found in database for chapters:', finderResult.chapters);

			return {
				message: generateNoChaptersFoundResponse(),
				usage: {
					finder: finderResult.usage,
					main: undefined
				}
			};
		}

		stage = 'main_agent';
		const mainStart = Date.now();
		// Stage 3: Generate response using Main Agent
		const mainResult = await generateLeaveResponse(
			{
				messages: input.messages,
				mainPrompt: config.prompts.main,
				policyContent: [formatChunksForLLM(chunks)]
			},
			env
		);
		performanceMetrics.main_agent = Date.now() - mainStart;

		performanceMetrics.total = Date.now() - startTime;
		console.log('Leave query completed successfully:', performanceMetrics);

		return {
			message: mainResult.response,
			usage: {
				finder: finderResult.usage,
				main: mainResult.usage
			}
		};
	} catch (error) {
		console.error(`Leave handler error in ${stage}:`, error);

		if (error && typeof error === 'object' && 'code' in error) {
			// Re-throw PolicyFooError as-is
			throw error;
		}

		// Wrap unexpected errors
		throw {
			code: 'GENERAL_ERROR' as const,
			message: `${ERROR_MESSAGES.GENERAL_ERROR}: ${error instanceof Error ? error.message : 'Unknown leave handler error'}`,
			details: { originalError: error, stage }
		};
	}
}

/**
 * Load leave policy configuration including prompts and chapter list
 */
async function loadLeaveConfig(env: PolicyFooEnvironment): Promise<PolicyHandlerConfig & { chapterList: string }> {
	try {
		// Get available chapters from database
		const availableChapters = await getAvailableChapters();
		
		// Format chapter list for finder prompt
		const chapterList = availableChapters.map(chapter => {
			const chapterNum = parseInt(chapter);
			const chapterName = getChapterName(chapterNum);
			return `${chapter}: ${chapterName}`;
		}).join('\n');

		return {
			readerModel: env.READER_MODEL || MODEL_CONFIG.READER_MODEL,
			mainModel: env.MAIN_MODEL || MODEL_CONFIG.MAIN_MODEL,
			prompts: {
				finder: finderPromptRaw,
				main: mainPromptRaw,
				policyList: '' // Not used in leave policy handler
			},
			chapterList
		};
	} catch (error) {
		console.error('Leave config loading error:', error);

		if (error && typeof error === 'object' && 'code' in error) {
			throw error;
		}

		throw {
			code: 'PROMPT_NOT_FOUND' as const,
			message: `${ERROR_MESSAGES.PROMPT_NOT_FOUND}: ${error instanceof Error ? error.message : 'Unknown config loading error'}`,
			details: { originalError: error }
		};
	}
}

/**
 * Get chapter name by number
 */
function getChapterName(chapterNum: number): string {
	const chapterNames: Record<number, string> = {
		0: 'Preface and General Information',
		1: 'Definitions',
		2: 'General Administration',
		3: 'Annual Leave',
		4: 'Regular Force Accumulated Leave',
		5: 'Special Leave',
		6: 'Sick Leave',
		7: 'Compassionate Leave',
		8: 'Leave Without Pay and Allowances',
		9: 'Short Leave',
		10: 'Regular Force Retirement Leave',
		11: 'Audit'
	};

	return chapterNames[chapterNum] || `Chapter ${chapterNum}`;
}

/**
 * Generate response when no chapters are found
 */
function generateNoChaptersFoundResponse(): string {
	return `<response>
<answer>I'm sorry, but I couldn't identify relevant chapters from the CAF Leave Policy Manual for your question. This could be because:

1. Your question might be outside the scope of the leave policy manual
2. The query might need to be more specific about the type of leave you're asking about
3. There might be a technical issue with the chapter identification

For immediate assistance with leave-related questions, I recommend:
- Contacting your chain of command
- Referring to your unit's orderly room
- Checking the official CAF intranet for the most current leave policies
- Consulting with your unit's Human Resources staff

Could you please rephrase your question to be more specific about the type of leave or policy area you're interested in?</answer>
<citations>
</citations>
<follow_up>
</follow_up>
</response>`;
}

