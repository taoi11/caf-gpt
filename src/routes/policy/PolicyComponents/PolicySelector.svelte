<script lang="ts">
	export let policySets: string[];
	export let selected: string;
	export let compact: boolean = false;

	// Policy set descriptions
	const policyDescriptions: Record<string, string> = {
		DOAD: 'Defence Administrative Orders and Directives',
		LEAVE: 'Leave policies and procedures - Annual, sick, and special leave regulations'
	};

	// Handle selection change
	function handleChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		selected = target.value;
	}
</script>

<div class="space-y-{compact ? '3' : '6'}">
	{#if !compact}
		<div class="text-center">
			<h3 class="text-xl font-semibold text-gray-900 mb-2">Select Policy Set</h3>
			<p class="text-gray-600">Choose the type of policies you want to ask about:</p>
		</div>
	{/if}

	<div class="grid grid-cols-1 {compact ? 'md:grid-cols-3 gap-2' : 'md:grid-cols-2 gap-4'}">
		{#each policySets as policySet}
			<label
				class="flex items-start {compact
					? 'p-2'
					: 'p-4'} border border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 hover:bg-gray-50 transition-colors duration-200 {selected ===
				policySet
					? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
					: ''}"
			>
				<input
					type="radio"
					name="policy_set"
					value={policySet}
					bind:group={selected}
					on:change={handleChange}
					class="mt-1 mr-3 text-blue-600 border-gray-300 focus:ring-blue-500"
				/>
				<div class="flex-1">
					<div
						class="font-semibold {compact ? 'text-sm' : 'text-lg'} text-gray-900 {compact
							? 'mb-0'
							: 'mb-1'}"
					>
						{policySet}
					</div>
					{#if !compact}
						<div class="text-sm text-gray-600 leading-relaxed">
							{policyDescriptions[policySet] || 'Policy information and guidelines'}
						</div>
					{/if}
				</div>
			</label>
		{/each}
	</div>

	{#if !compact}
		<div class="text-center p-4 bg-blue-50 border border-blue-200 rounded-lg">
			<strong class="text-gray-900">Current Selection:</strong>
			<span class="text-blue-700">{selected}</span>
			{#if policyDescriptions[selected]}
				<br /><small class="text-sm text-gray-600 opacity-80">{policyDescriptions[selected]}</small>
			{/if}
		</div>
	{/if}
</div>
