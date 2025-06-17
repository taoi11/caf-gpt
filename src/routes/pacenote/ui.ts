/**
 * UI Utilities
 * 
 * Reusable UI helper functions for better user experience.
 */

/**
 * Smoothly scroll an element into view
 */
export function scrollIntoView(element: HTMLElement | null, options?: ScrollIntoViewOptions): void {
	if (!element) return;

	element.scrollIntoView({
		behavior: 'smooth',
		block: 'center',
		...options
	});
}

/**
 * Copy text to clipboard with error handling
 */
export async function copyToClipboard(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch (err) {
		console.error('Failed to copy to clipboard:', err);
		return false;
	}
}

/**
 * Small delay utility for DOM updates
 */
export function delay(ms: number = 50): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}
