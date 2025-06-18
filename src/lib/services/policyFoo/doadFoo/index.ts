/**
 * DOAD Policy Handler
 * 
 * Handles DOAD (Defence Operations and Activities Directives) policy queries.
 * Implements two-stage agent workflow: Finder → Main Agent.
 */

import type { 
	PolicyQueryInput, 
	PolicyQueryOutput, 
	PolicyHandlerConfig,
	PolicyMessage
} from '../types';
import type { PolicyFooEnvironment } from '../index';
import { MODEL_CONFIG, R2_CONFIG, PROMPT_PATHS, ERROR_MESSAGES } from '../constants';
import { readPolicyFileAsText } from '../r2.util';
import { findDOADPolicies } from './finder.js';
import { generateDOADResponse } from './main.js';

/**
 * Handle DOAD policy queries with two-stage agent workflow
 * 
 * @param input - Query input with messages and policy set
 * @param env - Environment variables and bindings
 * @returns Promise with policy query response
 */
export async function handleDOADQuery(
	input: PolicyQueryInput,
	env: PolicyFooEnvironment
): Promise<PolicyQueryOutput> {
	try {
		// Load required prompts
		const config = await loadDOADConfig(env);
		
		// Stage 1: Find relevant policies using Finder Agent
		const finderResult = await findDOADPolicies({
			messages: input.messages,
			finderPrompt: config.prompts.finder,
			policyListTable: config.prompts.policyList
		}, env);

		// If no policies found, return early response
		if (finderResult.policyNumbers.length === 0) {
			return {
				message: generateNoPoliciesFoundResponse(),
				usage: {
					finder: finderResult.usage,
					main: undefined
				}
			};
		}

		// Retrieve policy content from R2
		const policyContent = await retrievePolicyContent(
			finderResult.policyNumbers,
			config,
			env
		);

		// Stage 2: Generate response using Main Agent
		const mainResult = await generateDOADResponse({
			messages: input.messages,
			mainPrompt: config.prompts.main,
			policyContent
		}, env);

		return {
			message: mainResult.response,
			usage: {
				finder: finderResult.usage,
				main: mainResult.usage
			}
		};

	} catch (error) {
		console.error('DOAD handler error:', error);
		
		if (error && typeof error === 'object' && 'code' in error) {
			// Re-throw PolicyFooError as-is
			throw error;
		}
		
		// Wrap unexpected errors
		throw {
			code: 'GENERAL_ERROR' as const,
			message: `${ERROR_MESSAGES.GENERAL_ERROR}: ${error instanceof Error ? error.message : 'Unknown DOAD handler error'}`,
			details: { originalError: error }
		};
	}
}

/**
 * Load DOAD configuration including prompts
 */
async function loadDOADConfig(env: PolicyFooEnvironment): Promise<PolicyHandlerConfig> {
	try {
		const bucket = env.POLICIES!;
		
		// Load prompt files
		const [finderPrompt, mainPrompt, policyListTable] = await Promise.all([
			readPolicyFileAsText(bucket, `doadFoo/${PROMPT_PATHS.FINDER}`),
			readPolicyFileAsText(bucket, `doadFoo/${PROMPT_PATHS.MAIN}`),
			readPolicyFileAsText(bucket, `doadFoo/${PROMPT_PATHS.POLICY_LIST}`)
		]);

		return {
			readerModel: env.READER_MODEL || MODEL_CONFIG.READER_MODEL,
			mainModel: env.MAIN_MODEL || MODEL_CONFIG.MAIN_MODEL,
			prompts: {
				finder: finderPrompt,
				main: mainPrompt,
				policyList: policyListTable
			},
			r2Bucket: bucket,
			policyPathPrefix: R2_CONFIG.POLICY_PATHS.DOAD
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
 * Retrieve policy content from R2 bucket
 */
async function retrievePolicyContent(
	policyNumbers: string[],
	config: PolicyHandlerConfig,
	env: PolicyFooEnvironment
): Promise<string[]> {
	try {
		const bucket = env.POLICIES!;
		const policyPaths = policyNumbers.map(num => 
			`${config.policyPathPrefix}${num}.md`
		);

		// Attempt to read all policy files
		const policyContents: string[] = [];
		const errors: string[] = [];

		for (let i = 0; i < policyPaths.length; i++) {
			try {
				const content = await readPolicyFileAsText(bucket, policyPaths[i]);
				policyContents.push(content);
			} catch (error) {
				console.warn(`Failed to load policy ${policyNumbers[i]}:`, error);
				errors.push(`Policy ${policyNumbers[i]} not found`);
				// Continue with other policies
			}
		}

		// If no policies were successfully loaded, throw error
		if (policyContents.length === 0) {
			throw {
				code: 'POLICY_NOT_FOUND' as const,
				message: `${ERROR_MESSAGES.POLICY_NOT_FOUND}: None of the policies could be loaded`,
				details: { 
					requestedPolicies: policyNumbers,
					errors 
				}
			};
		}

		// If some policies failed to load, log warning but continue
		if (errors.length > 0) {
			console.warn(`Failed to load ${errors.length} out of ${policyNumbers.length} policies:`, errors);
		}

		return policyContents;

	} catch (error) {
		console.error('Policy content retrieval error:', error);
		
		if (error && typeof error === 'object' && 'code' in error) {
			throw error;
		}
		
		throw {
			code: 'R2_ERROR' as const,
			message: `${ERROR_MESSAGES.R2_ERROR}: ${error instanceof Error ? error.message : 'Unknown policy retrieval error'}`,
			details: { 
				policyNumbers,
				originalError: error 
			}
		};
	}
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
