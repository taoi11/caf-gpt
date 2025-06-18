/**
 * Leave Policy Handler
 * 
 * Handles CAF Leave policy queries with a simplified single-stage workflow.
 * Retrieves the comprehensive leave policy document and generates responses.
 */

import type { 
	PolicyQueryInput, 
	PolicyQueryOutput, 
	PolicyHandlerConfig
} from '../types';
import type { PolicyFooEnvironment } from '../index';
import { MODEL_CONFIG, R2_CONFIG, ERROR_MESSAGES } from '../constants';
import { readPolicyFileAsText } from '../r2.util';
import { generateLeaveResponse } from './main.js';

// Import prompt file directly from local codebase
import mainPromptRaw from './prompts/main.md?raw';

/**
 * Handle leave policy queries with single-stage workflow
 * 
 * @param input - Query input with messages and policy set
 * @param env - Environment variables and bindings
 * @returns Promise with policy query response
 */
export async function handleLeaveQuery(
	input: PolicyQueryInput,
	env: PolicyFooEnvironment
): Promise<PolicyQueryOutput> {
	try {
		// Load required configuration
		const config = await loadLeaveConfig(env);
		
		// Retrieve leave policy document from R2
		const leavePolicyContent = await retrieveLeavePolicyContent(config, env);

		// Generate response using Main Agent
		const mainResult = await generateLeaveResponse({
			messages: input.messages,
			mainPrompt: config.prompts.main,
			policyContent: [leavePolicyContent]
		}, env);

		return {
			message: mainResult.response,
			usage: {
				main: mainResult.usage
			}
		};

	} catch (error) {
		console.error('Leave handler error:', error);
		
		if (error && typeof error === 'object' && 'code' in error) {
			// Re-throw PolicyFooError as-is
			throw error;
		}
		
		// Wrap unexpected errors
		throw {
			code: 'GENERAL_ERROR' as const,
			message: `${ERROR_MESSAGES.GENERAL_ERROR}: ${error instanceof Error ? error.message : 'Unknown leave handler error'}`,
			details: { originalError: error }
		};
	}
}

/**
 * Load leave policy configuration including prompts
 */
async function loadLeaveConfig(env: PolicyFooEnvironment): Promise<PolicyHandlerConfig> {
	try {
		const bucket = env.POLICIES!;
		
		// Use imported prompt file from local codebase
		return {
			readerModel: '', // Not used in leave policy handler
			mainModel: env.MAIN_MODEL || MODEL_CONFIG.MAIN_MODEL,
			prompts: {
				finder: '', // Not used in leave policy handler
				main: mainPromptRaw,
				policyList: '' // Not used in leave policy handler
			},
			r2Bucket: bucket,
			policyPathPrefix: R2_CONFIG.POLICY_PATHS.LEAVE
		};

	} catch (error) {
		console.error('Leave config loading error:', error);
			
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
 * Retrieve leave policy document from R2 bucket
 */
async function retrieveLeavePolicyContent(
	config: PolicyHandlerConfig,
	env: PolicyFooEnvironment
): Promise<string> {
	try {
		const bucket = env.POLICIES!;
		const leavePolicyPath = `${config.policyPathPrefix}leave_policy_2025.md`;

		// Read the single leave policy document
		const policyContent = await readPolicyFileAsText(bucket, leavePolicyPath);
		
		if (!policyContent || policyContent.trim().length === 0) {
			throw {
				code: 'POLICY_NOT_FOUND' as const,
				message: `${ERROR_MESSAGES.POLICY_NOT_FOUND}: Leave policy document is empty`,
				details: { 
					policyPath: leavePolicyPath
				}
			};
		}

		return policyContent;

	} catch (error) {
		console.error('Leave policy content retrieval error:', error);
		
		if (error && typeof error === 'object' && 'code' in error) {
			throw error;
		}
		
		throw {
			code: 'R2_ERROR' as const,
			message: `${ERROR_MESSAGES.R2_ERROR}: ${error instanceof Error ? error.message : 'Unknown leave policy retrieval error'}`,
			details: { 
				policyPath: 'leave/leave_policy_2025.md',
				originalError: error 
			}
		};
	}
}

/**
 * Generate response when leave policy document is not found
 * This function is used as a fallback when the main document is unavailable
 */
export function generateLeavePolicyNotFoundResponse(): string {
	return `<response>
<answer>I'm sorry, but I'm currently unable to access the CAF Leave Policy document. This could be due to:

1. The leave policy document is temporarily unavailable
2. There may be a system maintenance issue
3. The policy document may have been moved or updated

For immediate assistance with leave-related questions, I recommend:
- Contacting your chain of command
- Referring to your unit's orderly room
- Checking the official CAF intranet for the most current leave policies
- Consulting with your unit's Human Resources staff

Please try again later, or contact system support if this issue persists.</answer>
<citations>
</citations>
<follow_up>Would you like me to help you with general information about CAF leave procedures, or do you need specific policy references?</follow_up>
</response>`;
}
