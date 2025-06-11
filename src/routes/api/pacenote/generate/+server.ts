import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { createPaceNoteService, type PaceNoteInput } from '$lib/server/services/pacenote.service.js';

export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		// Validate AI binding is available
		if (!platform?.env?.AI) {
			return json(
				{ error: 'AI service is not available' },
				{ status: 500 }
			);
		}

		// Parse request body
		const body = await request.json();
		const { rank, memberDetails, observations, competencyFocus } = body;

		// Validate required fields
		if (!rank || !memberDetails || !observations) {
			return json(
				{ 
					error: 'Missing required fields',
					details: 'rank, memberDetails, and observations are required'
				},
				{ status: 400 }
			);
		}

		// Create input object
		const input: PaceNoteInput = {
			rank,
			memberDetails,
			observations,
			competencyFocus
		};

		// Create PaceNote service instance
		const paceNoteService = createPaceNoteService(platform.env.AI);

		// Generate pace note
		const result = await paceNoteService.generatePaceNote(input);

		return json({
			success: true,
			data: result
		});

	} catch (error) {
		console.error('PaceNote generation error:', error);
		
		// Handle service-specific errors
		if (error && typeof error === 'object' && 'code' in error) {
			const serviceError = error as any;
			
			// Map error codes to HTTP status codes
			const statusMap: Record<string, number> = {
				'INVALID_RANK': 400,
				'INVALID_MEMBER_DETAILS': 400,
				'INVALID_OBSERVATIONS': 400,
				'MEMBER_DETAILS_TOO_LONG': 400,
				'OBSERVATIONS_TOO_LONG': 400,
				'RATE_LIMITED': 429,
				'TIMEOUT': 503,
				'MODEL_NOT_FOUND': 503,
				'AI_ERROR': 500,
				'PACENOTE_ERROR': 500
			};
			
			const status = statusMap[serviceError.code] || 500;
			
			return json(
				{ 
					error: serviceError.message,
					code: serviceError.code,
					details: serviceError.details
				},
				{ status }
			);
		}

		return json(
			{ error: 'An unexpected error occurred while generating the pace note' },
			{ status: 500 }
		);
	}
};

export const GET: RequestHandler = async ({ platform }) => {
	try {
		// Validate AI binding is available
		if (!platform?.env?.AI) {
			return json(
				{ error: 'AI service is not available' },
				{ status: 500 }
			);
		}

		// Create PaceNote service instance to get metadata
		const paceNoteService = createPaceNoteService(platform.env.AI);

		return json({
			success: true,
			data: {
				availableRanks: paceNoteService.getAvailableRanks(),
				aiConfig: paceNoteService.getAIConfig(),
				competencies: {
					Cpl: paceNoteService.getCompetenciesForRank('Cpl'),
					MCpl: paceNoteService.getCompetenciesForRank('MCpl'),
					Sgt: paceNoteService.getCompetenciesForRank('Sgt'),
					WO: paceNoteService.getCompetenciesForRank('WO')
				}
			}
		});

	} catch (error) {
		console.error('PaceNote metadata error:', error);
		
		return json(
			{ error: 'Failed to retrieve pace note configuration' },
			{ status: 500 }
		);
	}
};
