import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import {
	processPolicyQuery,
	getSupportedPolicySets,
	type PolicyQueryInput,
	type PolicyFooError
} from '$lib/modules/policyFoo';
import '$lib/core/types.js'; // Import for environment type extensions

/**
 * Load function to provide initial data to the page
 */
export const load: PageServerLoad = async () => {
	return {
		policy_sets: getSupportedPolicySets(),
		title: 'Policy Assistant',
		description: 'Ask questions about CAF policies and get authoritative answers with citations.'
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
			const data = await request.formData();

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
			let messages = [];
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

			// Get environment from platform (Cloudflare Workers)
			const env = platform?.env;
			if (!env) {
				console.error('Platform environment not available');
				return fail(500, {
					error: 'Service temporarily unavailable',
					field: 'general'
				});
			}

			// Validate required environment variables
			if (!env.OPENROUTER_TOKEN) {
				console.error('OPENROUTER_TOKEN not configured');
				return fail(500, {
					error: 'Service configuration error - please check environment variables',
					field: 'general'
				});
			}

			if (!env.AI_GATEWAY_BASE_URL) {
				console.error('AI_GATEWAY_BASE_URL not configured');
				return fail(500, {
					error: 'Service configuration error - please check environment variables',
					field: 'general'
				});
			}

			// Call policy service with Hyperdrive binding
			const result = await processPolicyQuery(input, {
				OPENROUTER_TOKEN: env.OPENROUTER_TOKEN,
				AI_GATEWAY_BASE_URL: env.AI_GATEWAY_BASE_URL,
				CF_AIG_TOKEN: env.CF_AIG_TOKEN || undefined,
				READER_MODEL: env.READER_MODEL,
				MAIN_MODEL: env.MAIN_MODEL,
				HYPERDRIVE: env.HYPERDRIVE // Pass Hyperdrive binding
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
