/**
 * Form Processing Utility
 * 
 * Handles form data parsing, validation, and error response formatting
 * for the PaceNote web interface.
 */

import { fail } from '@sveltejs/kit';
import { AVAILABLE_RANKS } from '$lib/modules/paceNote/constants.js';

// Form limits
const LIMITS = {
	maxObservationLength: 2000,
	maxCompetencyFocus: 5
};

export interface ParsedFormData {
	rank: string;
	observations: string;
	competencyFocus: string[];
}

export interface ValidationError {
	error: string;
	rank: string;
	observations: string;
	competencyFocus: string[];
}

/**
 * Parse form data into structured format
 */
export function parseFormData(data: FormData): ParsedFormData {
	const rank = data.get('rank')?.toString() || '';
	const observations = data.get('observations')?.toString() || '';
	
	// Parse competency focus (can be multiple values)
	const competencyFocus: string[] = [];
	data.getAll('competencyFocus').forEach(value => {
		const strValue = value.toString();
		if (strValue) competencyFocus.push(strValue);
	});

	return { rank, observations, competencyFocus };
}

/**
 * Validate parsed form data
 */
export function validateFormData({ rank, observations, competencyFocus }: ParsedFormData) {
	// Validate required fields
	if (!rank || !observations.trim()) {
		return fail(400, {
			error: 'Both rank and observations are required',
			rank,
			observations,
			competencyFocus
		});
	}

	// Validate rank
	const validRanks = AVAILABLE_RANKS.map(r => r.value);
	if (!validRanks.includes(rank)) {
		return fail(400, {
			error: `Rank must be one of: ${validRanks.join(', ')}`,
			rank,
			observations,
			competencyFocus
		});
	}

	// Validate observations length
	if (observations.length > LIMITS.maxObservationLength) {
		return fail(400, {
			error: `Observations must be less than ${LIMITS.maxObservationLength} characters`,
			rank,
			observations,
			competencyFocus
		});
	}

	// Validate competency focus count
	if (competencyFocus.length > LIMITS.maxCompetencyFocus) {
		return fail(400, {
			error: `Maximum ${LIMITS.maxCompetencyFocus} competency focus areas allowed`,
			rank,
			observations,
			competencyFocus
		});
	}

	return null; // No validation errors
}

/**
 * Create error response for configuration issues
 */
export function createConfigError(message: string, formData: ParsedFormData) {
	return fail(500, { 
		error: message,
		...formData
	});
}

/**
 * Create error response for service errors
 */
export function createServiceError(error: any, formData: ParsedFormData) {
	// Handle known service errors
	if (error && typeof error === 'object' && 'code' in error) {
		return fail(500, {
			error: error.message || 'Service error occurred',
			...formData,
			code: error.code,
			details: error.details
		});
	}

	// Unknown error
	return fail(500, {
		error: 'An unexpected error occurred while generating the pace note',
		...formData
	});
}

/**
 * Get form limits for client-side reference
 */
export function getFormLimits() {
	return LIMITS;
}
