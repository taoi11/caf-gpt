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

<div class="citation-renderer">
	<div class="citations-header">
		<span class="citations-icon">📋</span>
		<strong>Sources & References:</strong>
	</div>

	<div class="citations-list">
		{#each citations as citation, index}
			{@const parsed = parseCitation(citation)}
			<div class="citation-item">
				<div class="citation-number">
					{index + 1}.
				</div>
				<div class="citation-content">
					{#if isLinkable(parsed)}
						<!-- Linkable citation with policy number -->
						<div class="citation-main">
							<a 
								href={getPolicyUrl(parsed.policyNumber || '')}
								target="_blank"
								rel="noopener noreferrer"
								class="policy-link"
							>
								<span class="policy-number">DOAD {parsed.policyNumber}</span>
								<span class="external-link-icon">↗</span>
							</a>
							{#if parsed.title}
								<div class="policy-title">{parsed.title}</div>
							{/if}
						</div>
					{:else}
						<!-- Non-linkable citation -->
						<div class="citation-text">
							{parsed.fullText}
						</div>
					{/if}
				</div>
			</div>
		{/each}
	</div>

	<div class="citations-note">
		<small>
			Click on policy numbers to view the full document. 
			Please verify current policy versions through official CAF channels.
		</small>
	</div>
</div>

<style>
	.citation-renderer {
		background: #f8f9fa;
		border-radius: 8px;
		padding: 1rem;
		border: 1px solid #e9ecef;
	}

	.citations-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
		font-size: 0.9rem;
		color: var(--color-theme-2);
	}

	.citations-icon {
		font-size: 1rem;
	}

	.citations-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.citation-item {
		display: flex;
		gap: 0.75rem;
		align-items: flex-start;
	}

	.citation-number {
		font-weight: 600;
		color: var(--color-theme-1);
		min-width: 1.5rem;
		font-size: 0.9rem;
	}

	.citation-content {
		flex: 1;
		font-size: 0.9rem;
		line-height: 1.4;
	}

	.citation-main {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.policy-link {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--color-theme-1);
		text-decoration: none;
		font-weight: 600;
		transition: all 0.2s ease;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		background: white;
		border: 1px solid #e9ecef;
		width: fit-content;
	}

	.policy-link:hover {
		background: var(--color-theme-1);
		color: white;
		transform: translateY(-1px);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.policy-number {
		font-family: 'Courier New', monospace;
		font-size: 0.85rem;
	}

	.external-link-icon {
		font-size: 0.8rem;
		opacity: 0.7;
	}

	.policy-title {
		color: #6c757d;
		font-size: 0.85rem;
		font-style: italic;
		margin-top: 0.25rem;
		padding-left: 0.5rem;
	}

	.citation-text {
		color: #495057;
		padding: 0.25rem 0.5rem;
		background: white;
		border-radius: 4px;
		border: 1px solid #e9ecef;
	}

	.citations-note {
		padding-top: 0.75rem;
		border-top: 1px solid #e9ecef;
		color: #6c757d;
		text-align: center;
	}

	.citations-note small {
		font-size: 0.8rem;
		line-height: 1.3;
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		.citation-renderer {
			padding: 0.75rem;
		}

		.citation-item {
			gap: 0.5rem;
		}

		.citations-header {
			font-size: 0.85rem;
		}

		.citation-content {
			font-size: 0.85rem;
		}

		.policy-link {
			padding: 0.2rem 0.4rem;
			font-size: 0.85rem;
		}

		.policy-number {
			font-size: 0.8rem;
		}

		.citations-note small {
			font-size: 0.75rem;
		}
	}

	/* Focus styles for accessibility */
	.policy-link:focus {
		outline: 2px solid var(--color-theme-1);
		outline-offset: 2px;
	}

	/* Print styles */
	@media print {
		.policy-link {
			color: black;
			text-decoration: underline;
		}
		
		.external-link-icon {
			display: none;
		}
		
		.policy-link::after {
			content: " (" attr(href) ")";
			font-size: 0.8em;
			color: #666;
		}
	}
</style>
