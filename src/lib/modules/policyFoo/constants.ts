/**
 * PolicyFoo Service Constants
 * Co-located constants for the PolicyFoo service module.
 */

import type { PolicySet } from './types';

// Supported policy sets
export const POLICY_SETS: PolicySet[] = ['DOAD', 'LEAVE'];

// Model configuration for different agents
export const MODEL_CONFIG = {
	// Lighter model for policy identification tasks
	READER_MODEL: 'anthropic/claude-3-haiku',
	// More capable model for synthesis and comprehensive responses
	MAIN_MODEL: 'anthropic/claude-3-5-sonnet'
} as const;

// Prompt file paths relative to policy handler directories
export const PROMPT_PATHS = {
	FINDER: 'prompts/finder.md',
	MAIN: 'prompts/main.md',
	POLICY_LIST: 'prompts/DOAD-list-table.md' // DOAD specific for now
} as const;

// Error messages
export const ERROR_MESSAGES = {
	INVALID_POLICY_SET: 'Invalid policy set. Must be one of: DOAD, LEAVE',
	INVALID_MESSAGES: 'Messages must be a non-empty array',
	MESSAGES_EMPTY: 'Messages array cannot be empty',
	POLICY_NOT_FOUND: 'Policy not found',
	PROMPT_NOT_FOUND: 'Prompt file not found',
	AI_GATEWAY_ERROR: 'AI Gateway request failed',
	PARSING_ERROR: 'Failed to parse response',
	GENERAL_ERROR: 'An unexpected error occurred'
} as const;

// Maximum limits
export const LIMITS = {
	MAX_POLICIES_PER_QUERY: 5,
	MAX_MESSAGE_LENGTH: 8000,
	MAX_TOTAL_CONVERSATION_LENGTH: 32000
} as const;
