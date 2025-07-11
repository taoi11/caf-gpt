<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { scrollIntoView, delay } from './ui.js';
	import PaceNoteForm from './PaceNoteForm.svelte';
	import PaceNoteResults from './PaceNoteResults.svelte';
	import PaceNoteTips from './PaceNoteTips.svelte';

	// Props from server-side load function
	export let data: PageData;
	export let form: ActionData;

	// Reactive state based on server data
	$: availableRanks = data.availableRanks;
	$: isConfigured = data.isConfigured;

	// Form state - preserve user input independently of server response
	let selectedRank = '';
	let observations = '';
	let competencyFocus: string[] = [];
	let isGenerating = false;

	// Only restore form data on validation errors (so user can correct and retry)
	$: if (form && form.error && form.rank) {
		selectedRank = form.rank;
		observations = form.observations || '';
		competencyFocus = form.competencyFocus || [];
	}

	// Results from form action
	$: generatedFeedback = form?.success ? form.feedback : '';
	$: error = form?.error || '';
	$: usage = form?.success ? form.usage : { tokens: 0, cost: 0 };

	// Reference for output box scrolling
	let outputBoxElement: HTMLDivElement;

	// Handle form submission lifecycle
	function handleSubmitStart() {
		error = '';
	}

	async function handleSubmitComplete() {
		// Small delay to ensure DOM is updated before scrolling
		await delay(50);
		if (outputBoxElement) {
			scrollIntoView(outputBoxElement);
		}
	}
</script>

<svelte:head>
	<title>PaceNote Generator - CAF GPT</title>
	<meta
		name="description"
		content="Generate professional pace notes using AI with rank-specific competency frameworks."
	/>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
	<div class="text-center mb-12">
		<h1 class="text-4xl font-bold text-gray-900 mb-4">PaceNote Generator</h1>
		<p class="text-lg text-gray-600 max-w-2xl mx-auto">
			Generate good enough pacenotes for lazy J-bros.
		</p>
	</div>

	<div class="space-y-8">
		<!-- Input Form -->
		<PaceNoteForm
			{availableRanks}
			{isConfigured}
			{isGenerating}
			bind:selectedRank
			bind:observations
			bind:competencyFocus
			onSubmitStart={handleSubmitStart}
			onSubmitComplete={handleSubmitComplete}
		/>

		<!-- Results -->
		<div bind:this={outputBoxElement}>
			<PaceNoteResults {error} {generatedFeedback} {usage} {isGenerating} />
		</div>
	</div>

	<!-- Usage Tips -->
	<PaceNoteTips />
</div>
