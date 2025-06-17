import type { PageServerLoad, Actions } from './$types';
import { PaceNoteService } from '$lib/services/paceNote/service.js';
import type { PaceNoteInput, PaceNoteRank } from '$lib/services/paceNote/types.js';
import { AVAILABLE_RANKS } from '$lib/services/paceNote/constants.js';
import { hasRequiredConfig, validateEnvironmentConfig, validateR2Bucket } from './config.server.js';
import { 
	parseFormData, 
	validateFormData, 
	createConfigError, 
	createServiceError,
	getFormLimits 
} from './form.server.js';

// Load function - runs on server before page renders
export const load: PageServerLoad = async ({ platform }) => {
	return {
		availableRanks: AVAILABLE_RANKS,
		limits: getFormLimits(),
		isConfigured: hasRequiredConfig(platform)
	};
};

// Form actions - handle POST requests securely on server
export const actions: Actions = {
	generate: async ({ request, platform }) => {
		// Validate environment configuration
		const configResult = validateEnvironmentConfig(platform);
		if (!configResult.isValid) {
			const missingVars = configResult.missingVars!.join(', ');
			return createConfigError(
				`Missing required environment variables: ${missingVars}. Please set up your environment variables.`,
				{ rank: '', observations: '', competencyFocus: [] }
			);
		}

		// Validate R2 bucket availability
		if (!validateR2Bucket(platform)) {
			return createConfigError(
				'R2 bucket (POLICIES) is not available. Please check your Cloudflare bindings.',
				{ rank: '', observations: '', competencyFocus: [] }
			);
		}

		// Parse and validate form data
		const data = await request.formData();
		const formData = parseFormData(data);
		
		const validationError = validateFormData(formData);
		if (validationError) {
			return validationError;
		}

		try {
			const config = configResult.config!;
			
			// Create PaceNote service instance
			const paceNoteService = new PaceNoteService(
				config.openrouterToken,
				config.aiGatewayBaseUrl,
				config.model,
				config.policiesBucket!, // Validated above
				config.cfAigToken
			);

			// Prepare input for pace note generation
			const input: PaceNoteInput = {
				rank: formData.rank as PaceNoteRank,
				observations: formData.observations.trim(),
				competencyFocus: formData.competencyFocus
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
				observations: formData.observations,
				competencyFocus: formData.competencyFocus
			};

		} catch (error) {
			console.error('PaceNote generation error:', error);
			return createServiceError(error, formData);
		}
	}
};
