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
		label: 'Corporal (Cpl)'
	},
	{
		value: 'MCpl',
		label: 'Master Corporal (MCpl)'
	},
	{
		value: 'Sgt',
		label: 'Sergeant (Sgt)'
	},
	{
		value: 'WO',
		label: 'Warrant Officer (WO)'
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
	temperature: 0.1
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
