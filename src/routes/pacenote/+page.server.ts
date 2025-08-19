import type { PageServerLoad, Actions } from './$types';
import { PaceNoteService } from '$lib/modules/paceNote/service.js';
import type { PaceNoteInput, PaceNoteRank } from '$lib/modules/paceNote/types.js';
import { AVAILABLE_RANKS } from '$lib/modules/paceNote/constants.js';
import { hasRequiredConfig, validateEnvironmentConfig } from './config.server.js';
import {
	parseFormData,
	validateFormData,
	createConfigError,
	createServiceError,
	getFormLimits
} from './form.server.js';
import { validateTurnstileToken } from '$lib/core/turnstile.service.js';

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

		// Parse and validate form data
		const data = await request.formData();
		const formData = parseFormData(data);

		// Validate Turnstile token (if secret key is configured)
		const config = configResult.config!;
		if (config.TURNSTILE_SECRET_KEY) {
			const token = data.get('cf-turnstile-response')?.toString();
			const remoteIp = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || undefined;
			
			const turnstileResult = await validateTurnstileToken(token || '', config.TURNSTILE_SECRET_KEY, remoteIp);
			if (!turnstileResult.success) {
				return createConfigError(
					'Security verification failed. Please try again.',
					formData
				);
			}
		}

		const validationError = validateFormData(formData);
		if (validationError) {
			return validationError;
		}

		try {
			const config = configResult.config!;

			// Create PaceNote service instance
			const paceNoteService = new PaceNoteService(
				config.OPENROUTER_TOKEN,
				config.AI_GATEWAY_BASE_URL,
				config.FN_MODEL,
				config.CF_AIG_TOKEN
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
