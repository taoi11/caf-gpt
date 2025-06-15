/**
 * API Response Types
 * 
 * Type definitions for API request/response contracts
 */

// Base API Response
export interface ApiResponse<T = any> {
	success: boolean;
	data?: T;
	error?: string;
	code?: string;
	details?: Record<string, unknown>;
}

// PaceNote API Types
export interface PaceNoteRequest {
	rank: string;
	observations: string;
	competencyFocus?: string[];
}

export interface PaceNoteData {
	feedback: string;
	rank: string;
	generatedAt: string;
	usage: {
		tokens: number;
		cost: number;
	};
}

export interface PaceNoteConfigData {
	availableRanks: Array<{
		value: string;
		label: string;
		description: string;
	}>;
	limits: {
		maxObservationLength: number;
		maxCompetencyFocus: number;
	};
}

// Type guards for runtime type checking
export function isApiResponse(obj: unknown): obj is ApiResponse {
	return typeof obj === 'object' && obj !== null && 'success' in obj;
}

export function isPaceNoteData(obj: unknown): obj is PaceNoteData {
	return typeof obj === 'object' && obj !== null && 
		'feedback' in obj && 'rank' in obj && 'generatedAt' in obj;
}
