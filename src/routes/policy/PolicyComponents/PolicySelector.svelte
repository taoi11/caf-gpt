<script lang="ts">
	export let policySets: string[];
	export let selected: string;

	// Policy set descriptions
	const policyDescriptions: Record<string, string> = {
		DOAD: 'Defence Operations and Activities Directives - Operational policies and procedures',
		LEAVE: 'Leave policies and procedures - Annual, sick, and special leave regulations'
	};

	// Handle selection change
	function handleChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		selected = target.value;
	}
</script>

<div class="policy-selector">
	<div class="selector-header">
		<h3>Select Policy Set</h3>
		<p>Choose the type of policies you want to ask about:</p>
	</div>

	<div class="selector-options">
		{#each policySets as policySet}
			<label class="policy-option">
				<input
					type="radio"
					name="policy_set"
					value={policySet}
					bind:group={selected}
					on:change={handleChange}
				/>
				<div class="option-content">
					<div class="option-title">{policySet}</div>
					<div class="option-description">
						{policyDescriptions[policySet] || 'Policy information and guidelines'}
					</div>
				</div>
			</label>
		{/each}
	</div>

	<div class="current-selection">
		<strong>Current Selection:</strong> {selected}
		{#if policyDescriptions[selected]}
			<br><small>{policyDescriptions[selected]}</small>
		{/if}
	</div>
</div>

<style>
	.policy-selector {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.selector-header {
		text-align: center;
	}

	.selector-header h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--color-theme-2);
	}

	.selector-header p {
		margin: 0;
		color: #6c757d;
		font-size: 0.95rem;
	}

	.selector-options {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1rem;
	}

	.policy-option {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 1rem;
		border: 2px solid #e9ecef;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s ease;
		background: #f8f9fa;
	}

	.policy-option:hover {
		border-color: var(--color-theme-1);
		background: white;
		transform: translateY(-1px);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.policy-option:has(input:checked) {
		border-color: var(--color-theme-1);
		background: white;
		box-shadow: 0 0 0 3px rgba(var(--color-theme-1-rgb), 0.1);
	}

	.policy-option input[type="radio"] {
		margin: 0;
		transform: scale(1.2);
		accent-color: var(--color-theme-1);
	}

	.option-content {
		flex: 1;
	}

	.option-title {
		font-weight: 600;
		font-size: 1.1rem;
		color: var(--color-theme-2);
		margin-bottom: 0.25rem;
	}

	.option-description {
		font-size: 0.9rem;
		color: #6c757d;
		line-height: 1.4;
	}

	.current-selection {
		text-align: center;
		padding: 1rem;
		background: #e7f3ff;
		border-radius: 6px;
		border: 1px solid #b3d9ff;
		color: #0c5460;
	}

	.current-selection strong {
		color: var(--color-theme-2);
	}

	.current-selection small {
		opacity: 0.8;
		font-size: 0.85rem;
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		.selector-options {
			grid-template-columns: 1fr;
		}

		.policy-option {
			padding: 0.75rem;
		}

		.option-title {
			font-size: 1rem;
		}

		.option-description {
			font-size: 0.85rem;
		}
	}
</style>
