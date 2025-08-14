import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import {
	processPolicyQuery,
	getSupportedPolicySets,
	type PolicyQueryInput,
	type PolicyFooError
} from '$lib/modules/policyFoo';
import { hasRequiredConfig, validateEnvironmentConfig } from './config.server.js';
import { getEnv } from '$lib/core/env.js';
import { verifyTurnstile } from '$lib/core/turnstile';

/**
 * Load function to provide initial data to the page
 */
export const load: PageServerLoad = async ({ platform }) => {
	const env = getEnv(platform);
	return {
		policy_sets: getSupportedPolicySets(),
		title: 'Policy Assistant',
		description: 'Ask questions about CAF policies and get authoritative answers with citations.',
		isConfigured: hasRequiredConfig(platform),
		turnstileSiteKey: env.TURNSTILE_SITE_KEY ?? ''
	};
};

/**
 * Form actions for handling policy queries
 */
export const actions: Actions = {
	/**
	 * Handle policy query form submission
	 */
	query: async ({ request, platform }) => {
		try {
			// Validate environment configuration
			const configResult = validateEnvironmentConfig(platform);
			if (!configResult.isValid) {
				const missingVars = configResult.missingVars!.join(', ');
				return fail(500, {
					error: `Missing required environment variables: ${missingVars}. Please check your environment setup.`,
					field: 'general'
				});
			}

			const data = await request.formData();

			// Turnstile invisible token verification
			const token = (data.get('cf-turnstile-response') as string) || '';
			const env = getEnv(platform);
			const secret = env.TURNSTILE_SECRET_KEY;
			if (!secret) {
				return fail(500, {
					error: 'Human verification is not configured. Please contact the administrator.',
					field: 'general'
				});
			}
			const ok = token ? await verifyTurnstile(token, secret) : false;
			if (!ok) {
				return fail(400, {
					error: 'Human verification failed. Please retry.',
					field: 'general'
				});
			}

			// Extract form data
			const messagesJson = data.get('messages') as string;
			const policySet = data.get('policy_set') as string;
			const userMessage = data.get('user_message') as string;

			// Validate required fields
			if (!policySet) {
				return fail(400, {
					error: 'Policy set is required',
					field: 'policy_set'
				});
			}

			if (!userMessage || userMessage.trim().length === 0) {
				return fail(400, {
					error: 'Message cannot be empty',
					field: 'user_message'
				});
			}

			// Parse existing messages
			let messages = [] as any[];
			if (messagesJson) {
				try {
					messages = JSON.parse(messagesJson);
				} catch (error) {
					console.error('Failed to parse messages:', error);
					return fail(400, {
						error: 'Invalid message format',
						field: 'messages'
					});
				}
			}

			// Add new user message
			messages.push({
				role: 'user',
				content: userMessage.trim(),
				timestamp: Date.now()
			});

			// Prepare input for policy service
			const input: PolicyQueryInput = {
				messages,
				policy_set: policySet as any
			};

			const config = configResult.config!;

			// Call policy service with environment config
			const result = await processPolicyQuery(input, {
				OPENROUTER_TOKEN: config.OPENROUTER_TOKEN,
				AI_GATEWAY_BASE_URL: config.AI_GATEWAY_BASE_URL,
				CF_AIG_TOKEN: config.CF_AIG_TOKEN,
				READER_MODEL: config.READER_MODEL,
				MAIN_MODEL: config.MAIN_MODEL,
				HYPERDRIVE: config.HYPERDRIVE
			});

			// Return success response
			return {
				success: true,
				message: result.message,
				usage: result.usage,
				timestamp: Date.now()
			};
		} catch (error) {
			console.error('Policy query error:', error);

			// Handle PolicyFooError
			if (error && typeof error === 'object' && 'code' in error) {
				const policyError = error as PolicyFooError;
				return fail(400, {
					error: policyError.message,
					errorCode: policyError.code,
					field: 'general'
				});
			}

			// Handle unexpected errors
			return fail(500, {
				error: 'An unexpected error occurred. Please try again.',
				field: 'general'
			});
		}
	}
};
