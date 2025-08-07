<script lang="ts">
	import CitationRenderer from './CitationRenderer.svelte';

	export let xmlContent: string;
	export let onFollowUpClick: (question: string) => void;
	export let parsed:
		| {
				answer: string;
				citations: string[];
				follow_up?: string;
		  }
		| undefined = undefined;

	// Reactive parsing of XML content
	$: if (xmlContent) {
		parsed = parseXMLResponse(xmlContent);
	}

	/**
	 * Shared helper to parse citations from either DOM nodes or raw text.
	 */
	function parseCitations(input: Element | string | null): string[] {
		const citations: string[] = [];
		if (!input) return citations;

		// DOM Element path
		if (typeof input !== 'string') {
			const citationElements = input.querySelectorAll('citation');
			if (citationElements.length > 0) {
				citationElements.forEach((citation) => {
					const text = citation.textContent?.trim();
					if (text) {
						citations.push(text);
					}
				});
			} else {
				const citationsText = input.textContent?.trim();
				if (citationsText) {
					const citationLines = citationsText
						.split('\n')
						.map((line) => line.trim())
						.filter((line) => line.length > 0);
					citations.push(...citationLines);
				}
			}
		} else {
			// Raw string path (regex fallback)
			// First try to find individual <citation> tags
			const citationMatches = input.match(/<citation>([\s\S]*?)<\/citation>/g);
			if (citationMatches) {
				citationMatches.forEach((match) => {
					const citation = match.replace(/<\/?citation>/g, '').trim();
					if (citation) {
						citations.push(citation);
					}
				});
			} else {
				const citationsText = input.trim();
				if (citationsText) {
					const citationLines = citationsText
						.split('\n')
						.map((line) => line.trim())
						.filter((line) => line.length > 0);
					citations.push(...citationLines);
				}
			}
		}
		return citations;
	}

	/**
	 * Parse XML response from assistant
	 */
	function parseXMLResponse(xml: string): {
		answer: string;
		citations: string[];
		follow_up?: string;
	} {
		// Check for DOCTYPE or HTML content - fallback to text parsing
		if (xml.trim().startsWith('<!DOCTYPE')) {
			return parseTextFallback(xml);
		}

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

			// Extract citations using shared helper
			const citations = parseCitations(citationsElement);

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
		// Handle DOCTYPE or HTML content
		if (text.trim().startsWith('<!DOCTYPE')) {
			return {
				answer: 'Service temporarily unavailable. Please try again.',
				citations: [],
				follow_up: undefined
			};
		}

		// Try to extract content using regex patterns
		const answerMatch = text.match(/<answer>([\s\S]*?)<\/answer>/);
		const citationsMatch = text.match(/<citations>([\s\S]*?)<\/citations>/);
		const followUpMatch = text.match(/<follow_up>([\s\S]*?)<\/follow_up>/);

		const answer = answerMatch?.[1]?.trim() || text;

		const citations = parseCitations(citationsMatch?.[1] ?? '');

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

<div class="flex flex-col gap-4">
	{#if parsed}
		<!-- Answer Section -->
		<div class="leading-relaxed">
			<div class="text-gray-800">
				{@html `<p>${formatAnswer(parsed.answer)}</p>`}
			</div>
		</div>

		<!-- Citations Section -->
		{#if parsed.citations.length > 0}
			<div class="mt-4 mb-2">
				<CitationRenderer citations={parsed.citations} />
			</div>
		{/if}

		<!-- Follow-up Question Section -->
		{#if parsed.follow_up}
			<div class="mt-4 pt-4 border-t border-gray-200">
				<div class="flex items-center gap-2 mb-3 text-sm text-gray-500">
					<span class="text-base">💡</span>
					<strong>Suggested follow-up:</strong>
				</div>
				<button
					type="button"
					class="w-full bg-gray-50 border-2 border-gray-200 rounded-lg p-3 cursor-pointer transition-all duration-200 text-sm leading-relaxed text-left text-gray-700 font-medium hover:bg-white hover:border-blue-500 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
					on:click={handleFollowUpClick}
				>
					{parsed.follow_up}
				</button>
			</div>
		{/if}
	{:else}
		<!-- Fallback for unparseable content -->
		<div class="bg-yellow-50 border border-yellow-200 rounded-md p-4 text-yellow-800">
			<p class="m-0 text-sm leading-relaxed">{xmlContent}</p>
		</div>
	{/if}
</div>

<style>
	/* Global styles for formatted content */
	:global(.text-gray-800 p) {
		margin: 0 0 1rem 0;
	}

	:global(.text-gray-800 p:last-child) {
		margin-bottom: 0;
	}

	:global(.text-gray-800 strong) {
		color: #374151;
		font-weight: 600;
	}

	:global(.text-gray-800 em) {
		color: #3b82f6;
		font-style: italic;
	}
</style>
