/**
 * PaceNote Service Module
 * 
 * Co-located exports for the PaceNote service.
 */

// Export types
export type {
	PaceNoteInput,
	PaceNoteOutput,
	PaceNoteRank,
	RankInfo,
	PaceNoteError
} from './types.js';

// Export constants
export {
	AVAILABLE_RANKS,
	VALID_RANKS,
	AI_CONFIG,
	VALIDATION_LIMITS,
	R2_PATHS
} from './constants.js';

// Export service class and factory
export { PaceNoteService, createPaceNoteService } from './service.js';

// Export R2 utilities (co-located with service)
export { readFileAsText } from './r2.util.js';

// Export Workers AI services (co-located with service)
export {
	WorkersAIService,
	createWorkersAIService,
	type WorkersAIConfig,
	type WorkersAIMessage,
	type WorkersAIResponse,
	type WorkersAIError
} from './workers-ai.service.js';
