<script lang="ts">
	export let citations: string[];

	/**
	 * Parse citation to extract policy number and title if available
	 */
	function parseCitation(citation: string): {
		policyNumber?: string;
		title?: string;
		fullText: string;
	} {
		// Try to match DOAD pattern: "DOAD 5017-1" or "DOAD 5017-1: Title"
		const doadMatch = citation.match(/DOAD\s+(\d{4}-\d+)(?::\s*(.+))?/i);
		if (doadMatch) {
			return {
				policyNumber: doadMatch[1],
				title: doadMatch[2]?.trim(),
				fullText: citation
			};
		}

		// Try to match other policy patterns
		const policyMatch = citation.match(/([A-Z]+\s+\d{4}-\d+)(?::\s*(.+))?/);
		if (policyMatch) {
			return {
				policyNumber: policyMatch[1],
				title: policyMatch[2]?.trim(),
				fullText: citation
			};
		}

		// Return as-is if no pattern matches
		return {
			fullText: citation
		};
	}

	/**
	 * Generate a URL for the policy document (if available)
	 * This is a placeholder - in real implementation, you'd link to actual policy documents
	 */
	function getPolicyUrl(policyNumber: string): string {
		// For DOAD policies, you might link to official CAF policy repository
		// This is just an example structure
		return `https://www.canada.ca/en/department-national-defence/corporate/policies-standards/defence-operations-activities-directives/${policyNumber}.html`;
	}

	/**
	 * Check if citation has a linkable policy number
	 */
	function isLinkable(citation: { policyNumber?: string }): boolean {
		return !!citation.policyNumber;
	}
</script>

<div class="bg-gray-50 rounded-lg p-4 border border-gray-200">
	<div class="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-700">
		<span class="text-base">📋</span>
		<strong>Sources & References:</strong>
	</div>

	<div class="flex flex-col gap-3 mb-4">
		{#each citations as citation, index}
			{@const parsed = parseCitation(citation)}
			<div class="flex gap-3 items-start">
				<div class="font-semibold text-blue-600 min-w-[1.5rem] text-sm">
					{index + 1}.
				</div>
				<div class="flex-1 text-sm leading-relaxed">
					{#if isLinkable(parsed)}
						<!-- Linkable citation with policy number -->
						<div class="flex flex-col gap-1">
							<a 
								href={getPolicyUrl(parsed.policyNumber || '')}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-2 text-blue-600 no-underline font-semibold transition-all duration-200 py-1 px-2 rounded bg-white border border-gray-200 w-fit hover:bg-blue-600 hover:text-white hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
							>
								<span class="font-mono text-xs">DOAD {parsed.policyNumber}</span>
								<span class="text-xs opacity-70">↗</span>
							</a>
							{#if parsed.title}
								<div class="text-gray-500 text-xs italic mt-1 pl-2">{parsed.title}</div>
							{/if}
						</div>
					{:else}
						<!-- Non-linkable citation -->
						<div class="text-gray-700 py-1 px-2 bg-white rounded border border-gray-200">
							{parsed.fullText}
						</div>
					{/if}
				</div>
			</div>
		{/each}
	</div>

	<div class="pt-3 border-t border-gray-200 text-center">
		<small class="text-xs text-gray-500 leading-tight">
			Click on policy numbers to view the full document. 
			Please verify current policy versions through official CAF channels.
		</small>
	</div>
</div>

<style>
	/* Print styles */
	@media print {
		.bg-gray-50 a {
			color: black !important;
			text-decoration: underline;
		}
		
		.bg-gray-50 a::after {
			content: " (" attr(href) ")";
			font-size: 0.8em;
			color: #666;
		}
	}
</style>
