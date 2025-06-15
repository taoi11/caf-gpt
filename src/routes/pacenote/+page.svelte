<script lang="ts">
	import { onMount } from 'svelte';
	import type { ApiResponse, PaceNoteConfigData, PaceNoteData } from '$lib/types/api.js';
	
	// API configuration - no authentication needed for internal use
	const API_BASE = '/api/pacenote';
	
	// State management
	let availableRanks: Array<{value: string, label: string, description: string}> = [];
	let selectedRank = '';
	let observations = '';
	let competencyFocus: string[] = [];
	let isGenerating = false;
	let generatedFeedback = '';
	let error = '';
	let usage = { tokens: 0, cost: 0 };
	
	// Load configuration on mount (no auth needed for config)
	onMount(async () => {
		try {
			const response = await fetch(API_BASE);
			
			if (response.ok) {
				const result: ApiResponse<PaceNoteConfigData> = await response.json();
				if (result.success && result.data) {
					availableRanks = result.data.availableRanks;
				}
			}
		} catch (err) {
			console.error('Failed to load configuration:', err);
		}
	});
	
	// Generate pace note (no API key needed - internal only)
	async function generatePaceNote() {
		if (!selectedRank || !observations.trim()) {
			error = 'Please select a rank and provide observations';
			return;
		}
		
		isGenerating = true;
		error = '';
		generatedFeedback = '';
		
		try {
			const response = await fetch(API_BASE, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					rank: selectedRank,
					observations: observations.trim(),
					competencyFocus
				})
			});
			
			const result: ApiResponse<PaceNoteData> = await response.json();
			
			if (response.ok && result.success && result.data) {
				generatedFeedback = result.data.feedback;
				usage = result.data.usage;
			} else {
				error = result.error || 'Failed to generate pace note';
			}
		} catch (err) {
			error = 'Network error. Please try again.';
			console.error('Generation error:', err);
		} finally {
			isGenerating = false;
		}
	}
	
	// Copy to clipboard
	async function copyToClipboard() {
		try {
			await navigator.clipboard.writeText(generatedFeedback);
			// Show success feedback
		} catch (err) {
			console.error('Failed to copy:', err);
		}
	}
	
	// Clear form
	function clearForm() {
		selectedRank = '';
		observations = '';
		competencyFocus = [];
		generatedFeedback = '';
		error = '';
		usage = { tokens: 0, cost: 0 };
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

	<div class="grid lg:grid-cols-2 gap-8">
		<!-- Input Form -->
		<div class="bg-white rounded-lg shadow-sm border p-6">
			<h2 class="text-xl font-semibold text-gray-900 mb-6">Generate Pace Note</h2>
			
			<!-- Rank Selection -->
			<div class="mb-6">
				<label for="rank" class="block text-sm font-medium text-gray-700 mb-2">
					Rank *
				</label>
				<select 
					id="rank" 
					bind:value={selectedRank}
					class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
					disabled={isGenerating}
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
					bind:value={observations}
					placeholder="Describe the member's performance, behaviors, and achievements that should be included in the pace note..."
					rows="6"
					class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
					disabled={isGenerating}
				></textarea>
				<p class="text-sm text-gray-500 mt-1">
					{observations.length}/2000 characters
				</p>
			</div>
			
			<!-- Actions -->
			<div class="flex gap-3">
				<button
					on:click={generatePaceNote}
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
					on:click={clearForm}
					disabled={isGenerating}
					class="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
				>
					Clear
				</button>
			</div>
		</div>
		
		<!-- Results -->
		<div class="bg-white rounded-lg shadow-sm border p-6">
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
