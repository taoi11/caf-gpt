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

<div class="bg-gray-50/50 rounded-lg p-3 border border-gray-200/50">
	<div class="flex items-center gap-2 mb-2 text-xs font-medium text-gray-600">
		<span class="text-sm">📋</span>
		<span>Sources & References</span>
	</div>

	<div class="flex flex-col gap-2 mb-3">
		{#each citations as citation, index}
			{@const parsed = parseCitation(citation)}
			<div class="flex gap-2 items-start">
				<div class="font-medium text-blue-600 min-w-[1.2rem] text-xs">
					{index + 1}.
				</div>
				<div class="flex-1 text-xs leading-relaxed">
					<!-- Citation display without links -->
					<div class="text-gray-600 py-0.5 px-1.5 bg-white rounded border border-gray-200">
						{parsed.fullText}
					</div>
				</div>
			</div>
		{/each}
	</div>

	<div class="pt-2 border-t border-gray-200/50 text-center">
		<small class="text-xs text-gray-500 leading-tight">
			Please verify current policy versions through official CAF channels.
		</small>
	</div>
</div>


