/**
 * PolicyFoo Service Example Usage
 * 
 * This file demonstrates how to use the PolicyFoo service.
 * It's not a test file, but rather a reference implementation.
 */

import { processPolicyQuery, type PolicyQueryInput, type PolicyFooEnvironment } from './index.js';

/**
 * Example usage of PolicyFoo service
 */
export async function examplePolicyQuery(): Promise<void> {
	// Example environment (would come from actual Cloudflare Workers environment)
	const env: PolicyFooEnvironment = {
		OPENROUTER_TOKEN: 'your-openrouter-token',
		AI_GATEWAY_BASE_URL: 'https://your-ai-gateway-url',
		CF_AIG_TOKEN: 'your-caf-aig-token',
		READER_MODEL: 'anthropic/claude-3-haiku',
		MAIN_MODEL: 'anthropic/claude-3-5-sonnet',
		POLICIES: undefined as any // R2 bucket binding would be provided by Cloudflare
	};

	// Example input
	const input: PolicyQueryInput = {
		policy_set: 'DOAD',
		messages: [
			{
				role: 'user',
				content: 'What are the requirements for leave approval in the Canadian Armed Forces?',
				timestamp: Date.now()
			}
		]
	};

	try {
		const result = await processPolicyQuery(input, env);
		
		console.log('Policy response:', result.message);
		console.log('Usage statistics:', result.usage);
		
		// The response would be XML that the frontend can parse:
		// <response>
		//   <answer>...</answer>
		//   <citations>...</citations>
		//   <follow_up>...</follow_up>
		// </response>
		
	} catch (error) {
		console.error('Policy query failed:', error);
	}
}

/**
 * Example of multi-turn conversation
 */
export async function exampleMultiTurnConversation(): Promise<void> {
	const env: PolicyFooEnvironment = {
		OPENROUTER_TOKEN: 'your-openrouter-token',
		AI_GATEWAY_BASE_URL: 'https://your-ai-gateway-url', 
		CF_AIG_TOKEN: 'your-caf-aig-token',
		POLICIES: undefined as any
	};

	// Multi-turn conversation with context
	const input: PolicyQueryInput = {
		policy_set: 'DOAD',
		messages: [
			{
				role: 'user',
				content: 'What are the requirements for leave approval?'
			},
			{
				role: 'assistant',
				content: '<response><answer>Based on DOAD 5017-1...</answer><citations>DOAD 5017-1</citations></response>'
			},
			{
				role: 'user', 
				content: 'What about emergency leave specifically?'
			}
		]
	};

	try {
		const result = await processPolicyQuery(input, env);
		console.log('Follow-up response:', result.message);
	} catch (error) {
		console.error('Multi-turn query failed:', error);
	}
}
