/**
 * PolicyFoo Service Router
 * 
 * Main entry point for PolicyFoo service.
 * Routes queries to appropriate policy-specific handlers based on policy_set.
 * Supports stateless request processing with conversation context.
 */

import type { 
	PolicyQueryInput, 
	PolicyQueryOutput, 
	PolicySet, 
	PolicyMessage,
	PolicyFooError 
} from './types.js';
import { POLICY_SETS, ERROR_MESSAGES, LIMITS } from './constants.js';
import { handleDOADQuery } from './doadFoo/index.js';

// Re-export types for easier consumption
export type { 
	PolicyQueryInput, 
	PolicyQueryOutput, 
	PolicySet, 
	PolicyMessage,
	PolicyFooError 
} from './types.js';

/**
 * Environment variables required for PolicyFoo service
 */
export interface PolicyFooEnvironment {
	OPENROUTER_TOKEN: string;
	AI_GATEWAY_BASE_URL: string;
	CF_AIG_TOKEN: string;
	READER_MODEL?: string;
	MAIN_MODEL?: string;
	POLICIES?: R2Bucket; // R2 bucket binding for policy documents
}

/**
 * Main service function to process policy queries
 * 
 * @param input - Query input with messages and policy set
 * @param env - Environment variables and bindings
 * @returns Promise with policy query response
 */
export async function processPolicyQuery(
	input: PolicyQueryInput,
	env: PolicyFooEnvironment
): Promise<PolicyQueryOutput> {
	try {
		// Validate input
		validateInput(input);
		
		// Validate environment
		validateEnvironment(env);

		// Route to appropriate policy handler
		switch (input.policy_set) {
			case 'DOAD':
				return await handleDOADQuery(input, env);
			
			case 'LEAVE':
				throw createError('GENERAL_ERROR', 'LEAVE policy handler not yet implemented');
			
			default:
				throw createError('INVALID_POLICY_SET', `Unsupported policy set: ${input.policy_set}`);
		}

	} catch (error) {
		console.error('PolicyFoo service error:', error);
		
		if (error && typeof error === 'object' && 'code' in error) {
			// Re-throw PolicyFooError as-is
			throw error;
		}
		
		// Wrap unexpected errors
		throw createError('GENERAL_ERROR', 
			error instanceof Error ? error.message : 'Unknown error occurred',
			{ originalError: error }
		);
	}
}

/**
 * Validate input parameters
 */
function validateInput(input: PolicyQueryInput): void {
	if (!input.policy_set) {
		throw createError('INVALID_POLICY_SET', 'policy_set is required');
	}

	if (!POLICY_SETS.includes(input.policy_set)) {
		throw createError('INVALID_POLICY_SET', 
			`Invalid policy set '${input.policy_set}'. Must be one of: ${POLICY_SETS.join(', ')}`);
	}

	if (!Array.isArray(input.messages)) {
		throw createError('INVALID_MESSAGES', 'messages must be an array');
	}

	if (input.messages.length === 0) {
		throw createError('MESSAGES_EMPTY', 'messages array cannot be empty');
	}

	// Validate individual messages
	for (const message of input.messages) {
		validateMessage(message);
	}

	// Check total conversation length
	const totalLength = input.messages.reduce((sum, msg) => sum + msg.content.length, 0);
	if (totalLength > LIMITS.MAX_TOTAL_CONVERSATION_LENGTH) {
		throw createError('INVALID_MESSAGES', 
			`Total conversation length (${totalLength}) exceeds maximum (${LIMITS.MAX_TOTAL_CONVERSATION_LENGTH})`);
	}
}

/**
 * Validate individual message
 */
function validateMessage(message: PolicyMessage): void {
	if (!message.role || !['user', 'assistant', 'system'].includes(message.role)) {
		throw createError('INVALID_MESSAGES', 
			`Invalid message role '${message.role}'. Must be user, assistant, or system`);
	}

	if (typeof message.content !== 'string') {
		throw createError('INVALID_MESSAGES', 'Message content must be a string');
	}

	if (message.content.length === 0) {
		throw createError('INVALID_MESSAGES', 'Message content cannot be empty');
	}

	if (message.content.length > LIMITS.MAX_MESSAGE_LENGTH) {
		throw createError('INVALID_MESSAGES', 
			`Message content length (${message.content.length}) exceeds maximum (${LIMITS.MAX_MESSAGE_LENGTH})`);
	}
}

/**
 * Validate environment variables
 */
function validateEnvironment(env: PolicyFooEnvironment): void {
	const required = ['OPENROUTER_TOKEN', 'AI_GATEWAY_BASE_URL', 'CF_AIG_TOKEN'];
	
	for (const key of required) {
		if (!env[key as keyof PolicyFooEnvironment]) {
			throw createError('GENERAL_ERROR', `Missing required environment variable: ${key}`);
		}
	}

	if (!env.POLICIES) {
		throw createError('GENERAL_ERROR', 'Missing POLICIES R2 bucket binding');
	}
}

/**
 * Create a standardized PolicyFoo error
 */
function createError(
	code: PolicyFooError['code'], 
	message: string, 
	details?: Record<string, unknown>
): PolicyFooError {
	return {
		code,
		message: `${ERROR_MESSAGES[code]}: ${message}`,
		details
	};
}

/**
 * Get list of supported policy sets
 */
export function getSupportedPolicySets(): PolicySet[] {
	return [...POLICY_SETS];
}

/**
 * Check if a policy set is supported
 */
export function isPolicySetSupported(policySet: string): policySet is PolicySet {
	return POLICY_SETS.includes(policySet as PolicySet);
}
