<script lang="ts">
	import { copyToClipboard } from './ui.js';
	
	// Props
	export let error: string = '';
	export let generatedFeedback: string = '';
	export let usage: { tokens: number; cost: number } = { tokens: 0, cost: 0 };
	export let isGenerating: boolean = false;
	
	// Copy functionality with user feedback
	let copySuccess = false;
	
	async function handleCopyToClipboard() {
		const success = await copyToClipboard(generatedFeedback);
		if (success) {
			copySuccess = true;
			// Reset the success state after a short delay
			setTimeout(() => {
				copySuccess = false;
			}, 2000);
		}
	}
</script>

<div class="bg-white rounded-lg shadow-sm border p-6">
	<div class="flex items-center justify-between mb-6">
		<h2 class="text-xl font-semibold text-gray-900">Generated Pace Note</h2>
		{#if generatedFeedback}
			<button
				on:click={handleCopyToClipboard}
				class="text-sm text-blue-600 hover:text-blue-700 flex items-center transition-colors"
				class:text-green-600={copySuccess}
				class:hover:text-green-700={copySuccess}
			>
				{#if copySuccess}
					<svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
					</svg>
					Copied!
				{:else}
					<svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
					</svg>
					Copy
				{/if}
			</button>
		{/if}
	</div>
	
	{#if error}
		<div class="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
			<div class="flex">
				<svg class="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
					<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
				</svg>
				<p class="text-sm text-red-700">{error}</p>
			</div>
		</div>
	{/if}
	
	{#if generatedFeedback}
		<div class="space-y-4">
			<div class="prose max-w-none">
				<div class="bg-gray-50 rounded-md p-4 whitespace-pre-wrap font-mono text-sm">
					{generatedFeedback}
				</div>
			</div>
			
			{#if usage.tokens > 0}
				<div class="text-xs text-gray-500 border-t pt-3">
					<p>Tokens used: {usage.tokens} • Estimated cost: ${usage.cost.toFixed(4)}</p>
				</div>
			{/if}
		</div>
	{:else if !isGenerating}
		<div class="text-center py-12 text-gray-500">
			<svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
			</svg>
			<p>Your generated pace note will appear here</p>
		</div>
	{/if}
</div>
