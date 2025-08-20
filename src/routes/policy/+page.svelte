<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import type { PageData, ActionData } from './$types';
	import PolicySelector from './PolicyComponents/PolicySelector.svelte';
	import MessageList from './PolicyComponents/MessageList.svelte';
	import ResponseParser from './PolicyComponents/ResponseParser.svelte';
	import TurnstileWidget from '$lib/components/TurnstileWidget.svelte';

	export let data: PageData;
	export let form: ActionData;

	// Extract turnstile site key from server data
	$: turnstileSiteKey = data.turnstileSiteKey;

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

<div class="max-w-6xl mx-auto p-4 min-h-screen flex flex-col">
	{#if messages.length === 0}
		<header class="text-center border-b-2 border-blue-600 mb-8 pb-4">
			<h1 class="font-bold text-gray-700 text-4xl mb-2">Policy Assistant</h1>
			<p class="text-lg text-gray-600 opacity-80">{data.description}</p>
		</header>
	{/if}

	<main class="flex-1 flex flex-col {messages.length > 0 ? 'gap-2' : 'gap-6'}">
		<!-- Policy Selector -->
		<div class="bg-white {messages.length > 0 ? 'p-2' : 'p-4'} rounded-lg shadow-sm">
			<PolicySelector
				policySets={data.policy_sets}
				bind:selected={selectedPolicySet}
				compact={messages.length > 0}
			/>
		</div>

		<!-- Conversation Display -->
		<div
			class={messages.length > 0
				? 'bg-white rounded-lg shadow-sm overflow-hidden max-h-[75vh] flex-1 flex flex-col'
				: 'flex-1 bg-white rounded-lg shadow-sm overflow-hidden'}
		>
			{#if messages.length > 0}
				<div
					class="flex flex-col md:flex-row md:justify-between md:items-center gap-2 p-3 border-b border-gray-200"
				>
					<h2 class="text-xl font-semibold text-gray-800">Conversation</h2>
					<button
						type="button"
						class="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors duration-200 font-medium"
						on:click={clearConversation}
					>
						Clear
					</button>
				</div>
				<MessageList {messages} onFollowUpClick={handleFollowUpClick} />
			{:else}
				<div class="p-8 text-center">
					<h2 class="text-2xl font-semibold text-gray-800 mb-3">Ask a Policy Question</h2>
					<p class="text-gray-600 mb-6">
						Select a policy set and ask your question to get started.
					</p>
					<div class="max-w-md mx-auto text-left bg-gray-50 p-4 rounded-lg">
						<h3 class="font-semibold text-gray-700 mb-2">Example Questions:</h3>
						<ul class="text-sm text-gray-600 space-y-1">
							<li>• What are the leave approval requirements?</li>
							<li>• How do I request compassionate leave?</li>
							<li>• What is the policy on professional development?</li>
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
			class="bg-white {messages.length > 0 ? 'p-3' : 'p-4'} rounded-lg shadow-sm"
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
			<div class="space-y-4">
				<label for="user_message" class="sr-only">Your question</label>
				<div class="flex flex-col md:flex-row gap-3">
					<textarea
						id="user_message"
						name="user_message"
						bind:value={userMessage}
						placeholder={isLoading
							? 'Processing...'
							: `Ask a question about ${selectedPolicySet} policies...`}
						rows="3"
						disabled={isLoading}
						required
						class="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed resize-none"
					></textarea>

					<!-- Turnstile Widget -->
					{#if turnstileSiteKey}
						<TurnstileWidget siteKey={turnstileSiteKey} />
					{/if}

					<button
						type="submit"
						class="md:self-end px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200 font-medium flex items-center justify-center gap-2"
						disabled={isLoading || !userMessage.trim()}
					>
						{#if isLoading}
							<div
								class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
							></div>
							Processing...
						{:else}
							Ask
						{/if}
					</button>
				</div>
			</div>

			<!-- Error Display -->
			{#if form?.error}
				<div class="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800" role="alert">
					<strong class="block mb-1">Error:</strong>
					{form.error}
					{#if 'errorCode' in form && form.errorCode}
						<small class="text-sm opacity-80">(Code: {form.errorCode})</small>
					{/if}
				</div>
			{/if}
		</form>
	</main>
</div>
