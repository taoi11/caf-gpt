/**
 * PolicyFoo Service Types
 * 
 * Co-located types for the PolicyFoo service module.
 * Handles policy question answering with LLM-powered agents.
 */

/**
 * Supported policy sets for routing queries
 */
export type PolicySet = 'DOAD' | 'LEAVE';

/**
 * Message roles in conversation
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * Individual message in a conversation
 */
export interface PolicyMessage {
	role: MessageRole;
	content: string;
	timestamp?: number;
}

/**
 * Input parameters for policy query processing
 */
export interface PolicyQueryInput {
	messages: PolicyMessage[];
	policy_set: PolicySet;
}

/**
 * Output from policy query processing
 */
export interface PolicyQueryOutput {
	message: string; // Raw XML response from LLM
	usage?: {
		finder?: {
			prompt_tokens?: number;
			completion_tokens?: number;
			total_tokens?: number;
		};
		main?: {
			prompt_tokens?: number;
			completion_tokens?: number;
			total_tokens?: number;
		};
	};
}

/**
 * Configuration for AI Gateway service
 */
export interface PolicyAIGatewayConfig {
	model: string;
	maxTokens?: number;
	temperature?: number;
	topP?: number;
}

/**
 * Message format for AI Gateway
 */
export interface PolicyAIGatewayMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

/**
 * Response from AI Gateway
 */
export interface PolicyAIGatewayResponse {
	response: string;
	usage?: {
		prompt_tokens?: number;
		completion_tokens?: number;
		total_tokens?: number;
	};
}

/**
 * Policy finder agent input
 */
export interface PolicyFinderInput {
	messages: PolicyMessage[];
	finderPrompt: string;
	policyListTable: string;
}

/**
 * Policy finder agent output
 */
export interface PolicyFinderOutput {
	policyNumbers: string[]; // Array of policy numbers found
	usage?: {
		prompt_tokens?: number;
		completion_tokens?: number;
		total_tokens?: number;
	};
}

/**
 * Main policy agent input
 */
export interface PolicyMainInput {
	messages: PolicyMessage[];
	mainPrompt: string;
	policyContent: string[]; // Array of policy file contents
}

/**
 * Main policy agent output
 */
export interface PolicyMainOutput {
	response: string; // Raw XML response
	usage?: {
		prompt_tokens?: number;
		completion_tokens?: number;
		total_tokens?: number;
	};
}

/**
 * Service error types specific to PolicyFoo
 */
export interface PolicyFooError {
	code: 
		| 'INVALID_POLICY_SET' 
		| 'INVALID_MESSAGES' 
		| 'MESSAGES_EMPTY'
		| 'POLICY_NOT_FOUND'
		| 'POLICY_FILE_NOT_FOUND'
		| 'PROMPT_NOT_FOUND'
		| 'AI_GATEWAY_ERROR'
		| 'R2_ERROR'
		| 'PARSING_ERROR'
		| 'GENERAL_ERROR';
	message: string;
	details?: Record<string, unknown>;
}

/**
 * Configuration for policy-specific handlers
 */
export interface PolicyHandlerConfig {
	readerModel: string; // Model for finder agent
	mainModel: string;   // Model for main agent
	prompts: {
		finder: string;
		main: string;
		policyList: string;
	};
	r2Bucket: R2Bucket;
	policyPathPrefix: string; // e.g., "doad/" for DOAD policies
}

/**
 * Response structure expected from policy handlers
 */
export interface PolicyHandlerResponse {
	message: string; // Raw XML response from main agent
	usage?: {
		finder?: {
			prompt_tokens?: number;
			completion_tokens?: number;
			total_tokens?: number;
		};
		main?: {
			prompt_tokens?: number;
			completion_tokens?: number;
			total_tokens?: number;
		};
	};
}

/**
 * Re-export DOAD-specific types for convenience
 */
export type { 
	DOADChunk, 
	DOADMetadata, 
	MetadataSelectorInput, 
	MetadataSelectorOutput 
} from './doadFoo/types';
