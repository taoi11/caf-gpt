/**
 * PaceNote Service Types
 *
 * Co-located types for the PaceNote service module.
 */

/**
 * Valid CAF ranks for pace note generation
 */
export type PaceNoteRank = 'Cpl' | 'MCpl' | 'Sgt' | 'WO';

/**
 * Input parameters for pace note generation
 */
export interface PaceNoteInput {
	rank: PaceNoteRank;
	observations: string;
	competencyFocus?: string[];
}

/**
 * Output from pace note generation
 */
export interface PaceNoteOutput {
	feedback: string;
	rank: string;
	generatedAt: Date;
	usage: {
		tokens: number;
		cost: number;
	};
}

/**
 * Rank information with metadata
 */
export interface RankInfo {
	value: string;
	label: string;
}

/**
 * Service error types specific to PaceNote
 */
export interface PaceNoteError {
	code: 'INVALID_RANK' | 'INVALID_OBSERVATIONS' | 'OBSERVATIONS_TOO_LONG' | 'PACENOTE_ERROR';
	message: string;
	details?: Record<string, unknown>;
}
