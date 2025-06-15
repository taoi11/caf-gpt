import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { PaceNoteService } from '$lib/services/paceNote/service.js';
import type { PaceNoteInput } from '$lib/services/paceNote/types.js';
import type { PaceNoteRequest, ApiResponse, PaceNoteData, PaceNoteConfigData } from '$lib/types/api.js';

// Define a union type for valid ranks
type ValidRank = 'Cpl' | 'MCpl' | 'Sgt' | 'WO';

// Simple origin validation for internal-only access
function validateOrigin(request: Request): boolean {
	const origin = request.headers.get('origin');
	const referer = request.headers.get('referer');
	
	// Allow requests from same origin or direct navigation
	if (!origin && !referer) return true; // Direct navigation
	
	// Get the request URL to compare with origin
	const requestUrl = new URL(request.url);
	const expectedOrigin = `${requestUrl.protocol}//${requestUrl.host}`;
	
	// Also allow requests from dev.caf-gpt.com (your custom domain)
	const allowedOrigins = [
		expectedOrigin,
		'https://dev.caf-gpt.com'
	];
	
	// Check if origin or referer matches our allowed domains
	return allowedOrigins.some(allowed => 
		origin === allowed || referer?.startsWith(allowed)
	);
}

export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		// Validate origin for internal-only access
		if (!validateOrigin(request)) {
			return json(
				{ 
					error: 'Forbidden',
					message: 'Access denied - external requests not allowed',
					code: 'FORBIDDEN'
				},
				{ status: 403 }
			);
		}

		// Check if required services are available
		if (!platform?.env?.OPENROUTER_TOKEN) {
			return json(
				{ error: 'OpenRouter token is not configured' },
				{ status: 500 }
			);
		}

		if (!platform?.env?.AI_GATEWAY_BASE_URL) {
			return json(
				{ error: 'AI Gateway base URL is not configured' },
				{ status: 500 }
			);
		}

		if (!platform?.env?.FN_MODEL) {
			return json(
				{ error: 'AI model is not configured' },
				{ status: 500 }
			);
		}

		// Parse and validate request body
		const body: unknown = await request.json();
		
		// Type guard for request body
		if (!body || typeof body !== 'object') {
			return json(
				{ 
					error: 'Invalid request body',
					message: 'Request body must be a valid JSON object',
					code: 'VALIDATION_ERROR'
				},
				{ status: 400 }
			);
		}
		
		const { rank, observations, competencyFocus } = body as PaceNoteRequest;

		// Validate required fields
		if (!rank || !observations) {
			return json(
				{ 
					error: 'Missing required fields',
					message: 'Both rank and observations are required',
					code: 'VALIDATION_ERROR'
				},
				{ status: 400 }
			);
		}

		// Validate rank is one of the supported values
		const validRanks = ['Cpl', 'MCpl', 'Sgt', 'WO'];
		if (!validRanks.includes(rank)) {
			return json(
				{
					error: 'Invalid rank',
					message: `Rank must be one of: ${validRanks.join(', ')}`,
					code: 'VALIDATION_ERROR'
				},
				{ status: 400 }
			);
		}

		// Create PaceNote service instance
		const paceNoteService = new PaceNoteService(
			platform.env.OPENROUTER_TOKEN,
			platform.env.AI_GATEWAY_BASE_URL,
			platform.env.FN_MODEL,
			platform.env.POLICIES,
			(platform.env as any).CF_AIG_TOKEN
		);

		// Prepare input for pace note generation
		const input: PaceNoteInput = {
			rank: rank as ValidRank, // Use the refined type for rank
			observations,
			competencyFocus: competencyFocus || []
		};

		// Generate the pace note
		const result = await paceNoteService.generatePaceNote(input);

		// Return successful response
		return json({
			success: true,
			data: {
				feedback: result.feedback,
				rank: result.rank as string,
				generatedAt: result.generatedAt.toISOString(),
				usage: result.usage
			}
		});

	} catch (error) {
		console.error('PaceNote generation error:', error);

		// Handle known service errors
		if (error && typeof error === 'object' && 'code' in error) {
			const serviceError = error as any;
			
			const statusMap: Record<string, number> = {
				'INVALID_RANK': 400,
				'INVALID_OBSERVATIONS': 400, 
				'OBSERVATIONS_TOO_LONG': 400,
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

		// Unknown error
		return json(
			{ 
				error: 'An unexpected error occurred while generating the pace note',
				code: 'INTERNAL_ERROR'
			},
			{ status: 500 }
		);
	}
};

// Optional: GET endpoint to provide configuration data
export const GET: RequestHandler = async ({ request, platform }) => {
	try {
		// Configuration endpoint is public - no authentication required
		// This allows the frontend to fetch available ranks without API key
		
		// Return configuration data for the frontend
		return json({
			success: true,
			data: {
				availableRanks: [
					{ value: 'Cpl', label: 'Corporal (Cpl)', description: 'Junior NCO - Team leadership and technical proficiency' },
					{ value: 'MCpl', label: 'Master Corporal (MCpl)', description: 'Experienced NCO - Team mentoring and training' },
					{ value: 'Sgt', label: 'Sergeant (Sgt)', description: 'Senior NCO - Supervision and management' },
					{ value: 'WO', label: 'Warrant Officer (WO)', description: 'Senior leader - Strategic planning and organizational impact' }
				],
				limits: {
					maxObservationLength: 2000,
					maxCompetencyFocus: 5
				}
			}
		});

	} catch (error) {
		console.error('Configuration error:', error);
		return json(
			{ error: 'Failed to retrieve configuration' },
			{ status: 500 }
		);
	}
};
