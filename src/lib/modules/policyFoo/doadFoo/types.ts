/**
 * DOAD-specific types for database-driven policy handling
 */

import type { DOADChunk, DOADMetadata } from '../../../core/db/types';

/**
 * Input for metadata selector agent
 */
export interface MetadataSelectorInput {
	userQuery: string;
	doadMetadata: DOADMetadata[];
}

/**
 * Output from metadata selector agent
 */
export interface MetadataSelectorOutput {
	selectedChunkIds: string[];
	usage?: {
		prompt_tokens?: number;
		completion_tokens?: number;
		total_tokens?: number;
	};
}

/**
 * Enhanced policy content with chunk-based structure
 */
export interface ChunkBasedPolicyContent {
	chunks: DOADChunk[];
	doadNumbers: string[];
}

/**
 * Re-export database types for convenience
 */
export type { DOADChunk, DOADMetadata } from '../../../core/db/types';
