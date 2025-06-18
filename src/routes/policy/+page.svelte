<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import type { PageData, ActionData } from './$types';
	import PolicySelector from './PolicyComponents/PolicySelector.svelte';
	import MessageList from './PolicyComponents/MessageList.svelte';
	import ResponseParser from './PolicyComponents/ResponseParser.svelte';
	
	export let data: PageData;
	export let form: ActionData;

	// Client-side conversation state
	let messages: Array<{
		role: 'user' | 'assistant';
		content: string;
		timestamp: number;
		parsed?: {
			answer: string;
			citations: string[];
			follow_up?: string;
		};
	}> = [];

	let selectedPolicySet = data.policy_sets[0] || 'DOAD';
	let userMessage = '';
	let isLoading = false;
	let formElement: HTMLFormElement;

	// Handle successful form submission
	$: if (form?.success && form?.message) {
		// Add assistant response to conversation
		messages = [
			...messages,
			{
				role: 'assistant',
				content: form.message,
				timestamp: form.timestamp || Date.now()
			}
		];

		// Clear the input
		userMessage = '';
		
		// Reset form state
		form = null;
	}

	// Handle form errors
	$: if (form?.error) {
		// Errors are displayed in the template
		isLoading = false;
	}

	/**
	 * Enhanced form submission handler
	 */
	function handleSubmit() {
		if (!userMessage.trim()) return;
		
		isLoading = true;
		
		// Add user message to conversation immediately for better UX
		messages = [
			...messages,
			{
				role: 'user',
				content: userMessage.trim(),
				timestamp: Date.now()
			}
		];
	}

	/**
	 * Handle follow-up question clicks
	 */
	function handleFollowUpClick(followUpQuestion: string) {
		userMessage = followUpQuestion;
		// Trigger form submission
		if (formElement) {
			formElement.requestSubmit();
		}
	}

	/**
	 * Clear conversation
	 */
	function clearConversation() {
		messages = [];
		userMessage = '';
		form = null;
	}
</script>

<svelte:head>
	<title>{data.title}</title>
	<meta name="description" content={data.description} />
</svelte:head>

<div class="policy-assistant">
	<header class="policy-header">
		<h1>Policy Assistant</h1>
		<p class="policy-description">{data.description}</p>
	</header>

	<main class="policy-main">
		<!-- Policy Selector -->
		<div class="policy-selector-section">
			<PolicySelector 
				policySets={data.policy_sets} 
				bind:selected={selectedPolicySet} 
			/>
		</div>

		<!-- Conversation Display -->
		<div class="conversation-section">
			{#if messages.length > 0}
				<div class="conversation-header">
					<h2>Conversation</h2>
					<button 
						type="button" 
						class="clear-button"
						on:click={clearConversation}
					>
						Clear
					</button>
				</div>
				<MessageList {messages} onFollowUpClick={handleFollowUpClick} />
			{:else}
				<div class="conversation-placeholder">
					<h2>Ask a Policy Question</h2>
					<p>Select a policy set and ask your question to get started.</p>
					<div class="example-questions">
						<h3>Example Questions:</h3>
						<ul>
							<li>What are the leave approval requirements?</li>
							<li>How do I request compassionate leave?</li>
							<li>What is the policy on professional development?</li>
						</ul>
					</div>
				</div>
			{/if}
		</div>

		<!-- Query Form -->
		<form 
			bind:this={formElement}
			method="POST" 
			action="?/query"
			class="query-form"
			use:enhance={({ formElement, formData, action, cancel, submitter }) => {
				// Add current messages to form data
				formData.set('messages', JSON.stringify(messages));
				formData.set('policy_set', selectedPolicySet);
				
				handleSubmit();

				return async ({ result, update }) => {
					isLoading = false;
					await update();
				};
			}}
		>
			<div class="form-group">
				<label for="user_message" class="sr-only">Your question</label>
				<div class="input-group">
					<textarea
						id="user_message"
						name="user_message"
						bind:value={userMessage}
						placeholder="Ask a question about {selectedPolicySet} policies..."
						rows="3"
						disabled={isLoading}
						required
					></textarea>
					<button 
						type="submit" 
						class="submit-button"
						disabled={isLoading || !userMessage.trim()}
					>
						{#if isLoading}
							<span class="loading-spinner"></span>
							Processing...
						{:else}
							Ask
						{/if}
					</button>
				</div>
			</div>

			<!-- Error Display -->
			{#if form?.error}
				<div class="error-message" role="alert">
					<strong>Error:</strong> {form.error}
					{#if form?.errorCode}
						<small>(Code: {form.errorCode})</small>
					{/if}
				</div>
			{/if}
		</form>
	</main>
</div>

<style>
	.policy-assistant {
		max-width: 1200px;
		margin: 0 auto;
		padding: 1rem;
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.policy-header {
		text-align: center;
		margin-bottom: 2rem;
		padding-bottom: 1rem;
		border-bottom: 2px solid var(--color-theme-1);
	}

	.policy-header h1 {
		font-size: 2.5rem;
		font-weight: 700;
		color: var(--color-theme-2);
		margin-bottom: 0.5rem;
	}

	.policy-description {
		font-size: 1.1rem;
		color: var(--color-text);
		opacity: 0.8;
	}

	.policy-main {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.policy-selector-section {
		background: white;
		padding: 1rem;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.conversation-section {
		flex: 1;
		background: white;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.conversation-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		border-bottom: 1px solid #e5e5e5;
		background: #f8f9fa;
	}

	.conversation-header h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
	}

	.clear-button {
		padding: 0.5rem 1rem;
		background: #dc3545;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.875rem;
		transition: background-color 0.2s;
	}

	.clear-button:hover {
		background: #c82333;
	}

	.conversation-placeholder {
		padding: 3rem 2rem;
		text-align: center;
		color: #6c757d;
	}

	.conversation-placeholder h2 {
		margin-bottom: 1rem;
		color: var(--color-theme-2);
	}

	.example-questions {
		margin-top: 2rem;
		text-align: left;
		max-width: 400px;
		margin-left: auto;
		margin-right: auto;
	}

	.example-questions h3 {
		margin-bottom: 0.5rem;
		color: var(--color-theme-2);
	}

	.example-questions ul {
		list-style-type: none;
		padding: 0;
	}

	.example-questions li {
		padding: 0.5rem 0;
		border-bottom: 1px solid #e9ecef;
	}

	.query-form {
		background: white;
		padding: 1.5rem;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.form-group {
		margin-bottom: 1rem;
	}

	.input-group {
		display: flex;
		gap: 1rem;
		align-items: flex-end;
	}

	.input-group textarea {
		flex: 1;
		padding: 0.75rem;
		border: 2px solid #e9ecef;
		border-radius: 6px;
		font-family: inherit;
		font-size: 1rem;
		resize: vertical;
		min-height: 80px;
		transition: border-color 0.2s;
	}

	.input-group textarea:focus {
		outline: none;
		border-color: var(--color-theme-1);
		box-shadow: 0 0 0 3px rgba(var(--color-theme-1-rgb), 0.1);
	}

	.input-group textarea:disabled {
		background-color: #f8f9fa;
		cursor: not-allowed;
	}

	.submit-button {
		padding: 0.75rem 2rem;
		background: var(--color-theme-1);
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 120px;
		justify-content: center;
	}

	.submit-button:hover:not(:disabled) {
		background: var(--color-theme-2);
		transform: translateY(-1px);
	}

	.submit-button:disabled {
		background: #6c757d;
		cursor: not-allowed;
		transform: none;
	}

	.loading-spinner {
		width: 16px;
		height: 16px;
		border: 2px solid transparent;
		border-top: 2px solid currentColor;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.error-message {
		background: #f8d7da;
		color: #721c24;
		padding: 1rem;
		border-radius: 4px;
		border: 1px solid #f5c6cb;
		margin-top: 1rem;
	}

	.error-message strong {
		display: block;
		margin-bottom: 0.25rem;
	}

	.error-message small {
		opacity: 0.8;
		font-size: 0.875rem;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	/* Responsive Design */
	@media (max-width: 768px) {
		.policy-assistant {
			padding: 0.5rem;
		}

		.policy-header h1 {
			font-size: 2rem;
		}

		.input-group {
			flex-direction: column;
			align-items: stretch;
		}

		.submit-button {
			width: 100%;
		}

		.conversation-header {
			flex-direction: column;
			gap: 1rem;
			align-items: stretch;
		}
	}
</style>
