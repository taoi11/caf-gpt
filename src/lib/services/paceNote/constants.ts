/**
 * PaceNote Service Constants
 * 
 * Co-located constants for the PaceNote service module.
 */

import type { RankInfo } from './types.js';

/**
 * Available ranks with their display information
 */
export const AVAILABLE_RANKS: RankInfo[] = [
	{
		value: 'Cpl',
		label: 'Corporal (Cpl)',
		description: 'Junior NCO - Team leadership and technical proficiency'
	},
	{
		value: 'MCpl',
		label: 'Master Corporal (MCpl)', 
		description: 'Experienced NCO - Team mentoring and training'
	},
	{
		value: 'Sgt',
		label: 'Sergeant (Sgt)',
		description: 'Senior NCO - Supervision and management'
	},
	{
		value: 'WO',
		label: 'Warrant Officer (WO)',
		description: 'Senior leader - Strategic planning and organizational impact'
	}
];

/**
 * Valid rank values for validation
 */
export const VALID_RANKS = ['Cpl', 'MCpl', 'Sgt', 'WO'] as const;

/**
 * AI Gateway configuration for pace note generation
 * Note: model is configured via FN_MODEL environment variable
 */
export const AI_GATEWAY_CONFIG = {
	maxTokens: 800,
	temperature: 0.7,
	topP: 0.9
} as const;

/**
 * Validation limits
 */
export const VALIDATION_LIMITS = {
	MIN_OBSERVATIONS_LENGTH: 20,
	MAX_OBSERVATIONS_LENGTH: 2000
} as const;

/**
 * R2 file paths for external content
 */
export const R2_PATHS = {
	EXAMPLES: 'paceNote/examples.md',
	COMPETENCIES: (rank: string) => `paceNote/${rank.toLowerCase()}.md`
} as const;
