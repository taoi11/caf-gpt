<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	
	// Props from server-side load function
	export let data: PageData;
	export let form: ActionData;
	
	// Reactive state based on server data
	$: availableRanks = data.availableRanks;
	$: isConfigured = data.isConfigured;
	
	// Form state
	let selectedRank = form?.rank || '';
	let observations = form?.observations || '';
	let competencyFocus: string[] = form?.competencyFocus || [];
	let isGenerating = false;
	
	// Results from form action
	$: generatedFeedback = form?.success ? form.feedback : '';
	$: error = form?.error || '';
	$: usage = form?.success ? form.usage : { tokens: 0, cost: 0 };
	
	// Reference for output box scrolling
	let outputBoxElement: HTMLDivElement;
	
	// Form enhancement for better UX
	const handleSubmit = () => {
		isGenerating = true;
		error = '';
		return async ({ update }: { update: () => Promise<void> }) => {
			isGenerating = false;
			await update();
			// Scroll to center the output box after form submission
			if (outputBoxElement) {
				outputBoxElement.scrollIntoView({ 
					behavior: 'smooth', 
					block: 'center' 
				});
			}
		};
	};
	
	// Copy to clipboard
	async function copyToClipboard() {
		try {
			await navigator.clipboard.writeText(generatedFeedback);
			// Show success feedback - could add a toast notification here
		} catch (err) {
			console.error('Failed to copy:', err);
		}
	}
	
	// Clear form
	function clearForm() {
		selectedRank = '';
		observations = '';
		competencyFocus = [];
		// Note: form results will persist until next submission, which is expected SvelteKit behavior
	}
</script>

<svelte:head>
	<title>PaceNote Generator - CAF GPT</title>
	<meta name="description" content="Generate professional pace notes using AI with rank-specific competency frameworks." />
</svelte:head>

<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
	<div class="text-center mb-12">
		<h1 class="text-4xl font-bold text-gray-900 mb-4">
			PaceNote Generator
		</h1>
		<p class="text-lg text-gray-600 max-w-2xl mx-auto">
			Generate professional pace notes using AI with rank-specific competency frameworks 
			and structured feedback templates.
		</p>
	</div>

	<div class="space-y-8">
		<!-- Input Form -->
		<div class="bg-white rounded-lg shadow-sm border p-6">
			<h2 class="text-xl font-semibold text-gray-900 mb-6">Generate Pace Note</h2>
			
			{#if !isConfigured}
				<div class="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
					<div class="flex">
						<svg class="w-5 h-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
						</svg>
						<p class="text-sm text-yellow-700">Service not fully configured. Some features may not work.</p>
					</div>
				</div>
			{/if}

			<form method="POST" action="?/generate" use:enhance={handleSubmit}>
				<!-- Rank Selection -->
				<div class="mb-6">
					<label for="rank" class="block text-sm font-medium text-gray-700 mb-2">
						Rank *
					</label>
					<select 
						id="rank" 
						name="rank"
						bind:value={selectedRank}
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						disabled={isGenerating}
						required
					>
						<option value="">Select a rank...</option>
						{#each availableRanks as rank}
							<option value={rank.value}>{rank.label}</option>
						{/each}
					</select>
					{#if selectedRank}
						<p class="text-sm text-gray-500 mt-1">
							{availableRanks.find(r => r.value === selectedRank)?.description}
						</p>
					{/if}
				</div>
				
				<!-- Observations -->
				<div class="mb-6">
					<label for="observations" class="block text-sm font-medium text-gray-700 mb-2">
						Observations *
					</label>
					<textarea
						id="observations"
						name="observations"
						bind:value={observations}
						placeholder="Describe the member's performance, behaviors, and achievements that should be included in the pace note..."
						rows="6"
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
						disabled={isGenerating}
						maxlength="2000"
						required
					></textarea>
					<p class="text-sm text-gray-500 mt-1">
						{observations.length}/2000 characters
					</p>
				</div>
				
				<!-- Optional: Competency Focus (hidden inputs for now, could be expanded later) -->
				{#each competencyFocus as focus}
					<input type="hidden" name="competencyFocus" value={focus} />
				{/each}
				
				<!-- Actions -->
				<div class="flex gap-3">
					<button
						type="submit"
						disabled={isGenerating || !selectedRank || !observations.trim()}
						class="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md font-medium transition-colors flex items-center justify-center"
					>
						{#if isGenerating}
							<svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0l4 4-4 4v-4a4 4 0 00-4 8v-4l-4 4 4 4v-4a8 8 0 01-8-8z"></path>
							</svg>
							Generating...
						{:else}
							Generate Pace Note
						{/if}
					</button>
					
					<button
						type="button"
						on:click={clearForm}
						disabled={isGenerating}
						class="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
					>
						Clear
					</button>
				</div>
			</form>
		</div>
		
		<!-- Results -->
		<div bind:this={outputBoxElement} class="bg-white rounded-lg shadow-sm border p-6">
			<div class="flex items-center justify-between mb-6">
				<h2 class="text-xl font-semibold text-gray-900">Generated Pace Note</h2>
				{#if generatedFeedback}
					<button
						on:click={copyToClipboard}
						class="text-sm text-blue-600 hover:text-blue-700 flex items-center"
					>
						<svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
						</svg>
						Copy
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
	</div>
	
	<!-- Usage Tips -->
	<div class="mt-12 bg-blue-50 rounded-lg p-6">
		<h3 class="text-lg font-semibold text-blue-900 mb-4">Usage Tips</h3>
		<div class="grid md:grid-cols-2 gap-4 text-sm text-blue-800">
			<div>
				<h4 class="font-medium mb-2">Effective Observations</h4>
				<ul class="space-y-1 text-blue-700">
					<li>• Include specific examples and achievements</li>
					<li>• Mention dates and context when relevant</li>
					<li>• Focus on professional behaviors and competencies</li>
				</ul>
			</div>
			<div>
				<h4 class="font-medium mb-2">Best Practices</h4>
				<ul class="space-y-1 text-blue-700">
					<li>• Review and edit generated content before use</li>
					<li>• Ensure accuracy of names and details</li>
					<li>• Customize language to match your unit's style</li>
				</ul>
			</div>
		</div>
	</div>
</div>
