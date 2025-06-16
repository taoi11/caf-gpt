import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { PaceNoteService } from '$lib/services/paceNote/service.js';
import type { PaceNoteInput } from '$lib/services/paceNote/types.js';

// Define valid ranks
type ValidRank = 'Cpl' | 'MCpl' | 'Sgt' | 'WO';

// Configuration data
const AVAILABLE_RANKS = [
	{ value: 'Cpl', label: 'Corporal (Cpl)', description: 'Junior NCO - Team leadership and technical proficiency' },
	{ value: 'MCpl', label: 'Master Corporal (MCpl)', description: 'Experienced NCO - Team mentoring and training' },
	{ value: 'Sgt', label: 'Sergeant (Sgt)', description: 'Senior NCO - Supervision and management' },
	{ value: 'WO', label: 'Warrant Officer (WO)', description: 'Senior leader - Strategic planning and organizational impact' }
];

const LIMITS = {
	maxObservationLength: 2000,
	maxCompetencyFocus: 5
};

// Load function - runs on server before page renders
export const load: PageServerLoad = async ({ platform }) => {
	// Get environment variables from either Cloudflare Workers or Node.js
	const env = platform?.env || process.env;
	
	// Debug: Log available environment variables
	console.log('Available env vars:', {
		hasOpenRouter: !!env?.OPENROUTER_TOKEN,
		hasAIGateway: !!env?.AI_GATEWAY_BASE_URL,
		hasFnModel: !!env?.FN_MODEL,
		hasAPIKey: !!env?.API_KEY,
		hasCfAigToken: !!env?.CF_AIG_TOKEN
	});
	
	// Check if required environment variables are available
	const hasRequiredConfig = Boolean(
		env?.OPENROUTER_TOKEN &&
		env?.AI_GATEWAY_BASE_URL &&
		env?.FN_MODEL
	);

	// Debug information to return to client
	const debugInfo = {
		hasOpenRouter: !!env?.OPENROUTER_TOKEN,
		hasAIGateway: !!env?.AI_GATEWAY_BASE_URL,
		hasFnModel: !!env?.FN_MODEL,
		hasAPIKey: !!env?.API_KEY,
		hasCfAigToken: !!env?.CF_AIG_TOKEN,
		hasPoliciesBucket: !!platform?.env?.POLICIES
	};

	return {
		availableRanks: AVAILABLE_RANKS,
		limits: LIMITS,
		isConfigured: hasRequiredConfig,
		debug: debugInfo // Add debug info for troubleshooting
	};
};

// Form actions - handle POST requests securely on server
export const actions: Actions = {
	generate: async ({ request, platform }) => {
		// Get environment variables from either Cloudflare Workers or Node.js
		const env = platform?.env || process.env;
		
		// Check if required services are available
		if (!env?.OPENROUTER_TOKEN) {
			return fail(500, { 
				error: 'OpenRouter token is not configured. Please set up your environment variables.',
				rank: '',
				observations: '',
				competencyFocus: []
			});
		}

		if (!env?.AI_GATEWAY_BASE_URL) {
			return fail(500, { 
				error: 'AI Gateway base URL is not configured. Please set up your environment variables.',
				rank: '',
				observations: '',
				competencyFocus: []
			});
		}

		if (!env?.FN_MODEL) {
			return fail(500, { 
				error: 'AI model is not configured. Please set up your environment variables.',
				rank: '',
				observations: '',
				competencyFocus: []
			});
		}

		// Get form data
		const data = await request.formData();
		const rank = data.get('rank')?.toString() || '';
		const observations = data.get('observations')?.toString() || '';
		
		// Parse competency focus (can be multiple values)
		const competencyFocus: string[] = [];
		data.getAll('competencyFocus').forEach(value => {
			const strValue = value.toString();
			if (strValue) competencyFocus.push(strValue);
		});

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

		try {
			// Get environment variables from either Cloudflare Workers or Node.js
			const env = platform?.env || process.env;
			
			// Debug: Log available environment variables
			console.log('Available env vars:', {
				hasOpenRouter: !!env?.OPENROUTER_TOKEN,
				hasAIGateway: !!env?.AI_GATEWAY_BASE_URL,
				hasFnModel: !!env?.FN_MODEL,
				hasAPIKey: !!env?.API_KEY,
				hasCfAigToken: !!env?.CF_AIG_TOKEN,
				hasPoliciesBucket: !!platform?.env?.POLICIES
			});
			
			// Check if R2 bucket is available
			if (!platform?.env?.POLICIES) {
				return fail(500, { 
					error: 'R2 bucket (POLICIES) is not available. Please check your Cloudflare bindings.',
					rank,
					observations,
					competencyFocus
				});
			}
			
			// Create PaceNote service instance
			const paceNoteService = new PaceNoteService(
				env.OPENROUTER_TOKEN!,
				env.AI_GATEWAY_BASE_URL!,
				env.FN_MODEL!,
				platform.env.POLICIES, // R2 bucket only available in Cloudflare Workers
				env.CF_AIG_TOKEN
			);

			// Prepare input for pace note generation
			const input: PaceNoteInput = {
				rank: rank as ValidRank,
				observations: observations.trim(),
				competencyFocus
			};

			// Generate the pace note
			const result = await paceNoteService.generatePaceNote(input);

			// Return success with generated data
			return {
				success: true,
				feedback: result.feedback,
				rank: result.rank,
				generatedAt: result.generatedAt.toISOString(),
				usage: result.usage,
				observations,
				competencyFocus
			};

		} catch (error) {
			console.error('PaceNote generation error:', error);

			// Handle known service errors
			if (error && typeof error === 'object' && 'code' in error) {
				const serviceError = error as any;
				return fail(500, {
					error: serviceError.message || 'Service error occurred',
					rank,
					observations,
					competencyFocus,
					code: serviceError.code,
					details: serviceError.details
				});
			}

			// Unknown error
			return fail(500, {
				error: 'An unexpected error occurred while generating the pace note',
				rank,
				observations,
				competencyFocus
			});
		}
	}
};
