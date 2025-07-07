<script lang="ts">
	import { enhance, applyAction } from '$app/forms';
	import type { RankInfo } from '$lib/modules/paceNote/types.js';
	
	// Props
	export let availableRanks: RankInfo[];
	export let isConfigured: boolean;
	export let isGenerating: boolean;
	export let onSubmitStart: () => void;
	export let onSubmitComplete: (result: any) => Promise<void>;
	
	// Form state
	export let selectedRank: string = '';
	export let observations: string = '';
	export let competencyFocus: string[] = [];
	
	// Form enhancement for better UX
	const handleSubmit = () => {
		isGenerating = true;
		onSubmitStart();
		
		// Store current form values to preserve them
		const currentRank = selectedRank;
		const currentObservations = observations;
		const currentCompetencyFocus = [...competencyFocus];
		
		return async ({ result }: { result: any }) => {
			isGenerating = false;
			
			// Apply the action result but preserve our form state
			await applyAction(result);
			
			// Restore form values immediately to prevent any flash
			selectedRank = currentRank;
			observations = currentObservations;
			competencyFocus = currentCompetencyFocus;
			
			// Notify parent component
			await onSubmitComplete(result);
		};
	};
	
	// Clear form
	export function clearForm() {
		selectedRank = '';
		observations = '';
		competencyFocus = [];
	}
</script>

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
