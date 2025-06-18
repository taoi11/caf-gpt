<script lang="ts">
	import CitationRenderer from './CitationRenderer.svelte';

	export let xmlContent: string;
	export let onFollowUpClick: (question: string) => void;
	export let parsed: {
		answer: string;
		citations: string[];
		follow_up?: string;
	} | undefined = undefined;

	// Reactive parsing of XML content
	$: if (xmlContent) {
		parsed = parseXMLResponse(xmlContent);
	}

	/**
	 * Parse XML response from assistant
	 */
	function parseXMLResponse(xml: string): {
		answer: string;
		citations: string[];
		follow_up?: string;
	} {
		try {
			// Create a DOMParser to parse the XML
			const parser = new DOMParser();
			const doc = parser.parseFromString(xml, 'text/xml');

			// Check for parsing errors
			const parserError = doc.querySelector('parsererror');
			if (parserError) {
				console.warn('XML parsing error:', parserError.textContent);
				return parseTextFallback(xml);
			}

			// Extract elements
			const responseElement = doc.querySelector('response');
			if (!responseElement) {
				return parseTextFallback(xml);
			}

			const answerElement = responseElement.querySelector('answer');
			const citationsElement = responseElement.querySelector('citations');
			const followUpElement = responseElement.querySelector('follow_up');

			// Extract answer
			const answer = answerElement?.textContent?.trim() || 'No answer provided';

			// Extract citations
			const citations: string[] = [];
			if (citationsElement) {
				const citationElements = citationsElement.querySelectorAll('citation');
				citationElements.forEach(citation => {
					const text = citation.textContent?.trim();
					if (text) {
						citations.push(text);
					}
				});
			}

			// Extract follow-up question
			const follow_up = followUpElement?.textContent?.trim() || undefined;

			return {
				answer,
				citations,
				follow_up
			};

		} catch (error) {
			console.error('Error parsing XML response:', error);
			return parseTextFallback(xml);
		}
	}

	/**
	 * Fallback parsing for malformed XML
	 */
	function parseTextFallback(text: string): {
		answer: string;
		citations: string[];
		follow_up?: string;
	} {
		// Try to extract content using regex patterns
		const answerMatch = text.match(/<answer>([\s\S]*?)<\/answer>/);
		const citationsMatch = text.match(/<citations>([\s\S]*?)<\/citations>/);
		const followUpMatch = text.match(/<follow_up>([\s\S]*?)<\/follow_up>/);

		const answer = answerMatch?.[1]?.trim() || text;
		
		const citations: string[] = [];
		if (citationsMatch) {
			const citationMatches = citationsMatch[1].match(/<citation>([\s\S]*?)<\/citation>/g);
			if (citationMatches) {
				citationMatches.forEach(match => {
					const citation = match.replace(/<\/?citation>/g, '').trim();
					if (citation) {
						citations.push(citation);
					}
				});
			}
		}

		const follow_up = followUpMatch?.[1]?.trim() || undefined;

		return {
			answer,
			citations,
			follow_up
		};
	}

	/**
	 * Handle follow-up question click
	 */
	function handleFollowUpClick() {
		if (parsed?.follow_up) {
			onFollowUpClick(parsed.follow_up);
		}
	}

	/**
	 * Format answer text with basic markdown-like formatting
	 */
	function formatAnswer(answer: string): string {
		return answer
			.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
			.replace(/\*(.*?)\*/g, '<em>$1</em>')
			.replace(/\n\n/g, '</p><p>')
			.replace(/\n/g, '<br>');
	}
</script>

<div class="response-parser">
	{#if parsed}
		<!-- Answer Section -->
		<div class="answer-section">
			<div class="answer-content">
				{@html `<p>${formatAnswer(parsed.answer)}</p>`}
			</div>
		</div>

		<!-- Citations Section -->
		{#if parsed.citations.length > 0}
			<div class="citations-section">
				<CitationRenderer citations={parsed.citations} />
			</div>
		{/if}

		<!-- Follow-up Question Section -->
		{#if parsed.follow_up}
			<div class="follow-up-section">
				<div class="follow-up-header">
					<span class="follow-up-icon">💡</span>
					<strong>Suggested follow-up:</strong>
				</div>
				<button 
					type="button" 
					class="follow-up-button"
					on:click={handleFollowUpClick}
				>
					{parsed.follow_up}
				</button>
			</div>
		{/if}
	{:else}
		<!-- Fallback for unparseable content -->
		<div class="fallback-content">
			<p>{xmlContent}</p>
		</div>
	{/if}
</div>

<style>
	.response-parser {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.answer-section {
		line-height: 1.6;
	}

	.answer-content {
		color: #333;
	}

	.answer-content :global(p) {
		margin: 0 0 1rem 0;
	}

	.answer-content :global(p:last-child) {
		margin-bottom: 0;
	}

	.answer-content :global(strong) {
		color: var(--color-theme-2);
		font-weight: 600;
	}

	.answer-content :global(em) {
		color: var(--color-theme-1);
		font-style: italic;
	}

	.citations-section {
		margin-top: 0.5rem;
		padding-top: 1rem;
		border-top: 1px solid #e9ecef;
	}

	.follow-up-section {
		margin-top: 0.5rem;
		padding-top: 1rem;
		border-top: 1px solid #e9ecef;
	}

	.follow-up-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
		font-size: 0.9rem;
		color: #6c757d;
	}

	.follow-up-icon {
		font-size: 1rem;
	}

	.follow-up-button {
		background: #f8f9fa;
		border: 2px solid #e9ecef;
		border-radius: 8px;
		padding: 0.75rem 1rem;
		cursor: pointer;
		transition: all 0.2s ease;
		font-size: 0.9rem;
		line-height: 1.4;
		text-align: left;
		width: 100%;
		color: var(--color-theme-2);
		font-weight: 500;
	}

	.follow-up-button:hover {
		background: white;
		border-color: var(--color-theme-1);
		transform: translateY(-1px);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.follow-up-button:active {
		transform: translateY(0);
	}

	.fallback-content {
		background: #fff3cd;
		border: 1px solid #ffeaa7;
		border-radius: 6px;
		padding: 1rem;
		color: #856404;
	}

	.fallback-content p {
		margin: 0;
		font-size: 0.9rem;
		line-height: 1.4;
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		.response-parser {
			gap: 0.75rem;
		}

		.follow-up-button {
			padding: 0.5rem 0.75rem;
			font-size: 0.85rem;
		}

		.follow-up-header {
			font-size: 0.85rem;
		}
	}
</style>
