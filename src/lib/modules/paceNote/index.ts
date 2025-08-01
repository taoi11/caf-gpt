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
	AI_GATEWAY_CONFIG,
	VALIDATION_LIMITS,
	LOCAL_PATHS
} from './constants.js';

// Export service class and factory
export { PaceNoteService, createPaceNoteService } from './service.js';
