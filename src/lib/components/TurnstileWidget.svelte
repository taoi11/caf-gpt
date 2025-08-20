<script context="module" lang="ts">
	// Type declaration for global turnstile object
	declare global {
		interface Window {
			turnstile?: {
				render: (element: HTMLElement, options: any) => string;
				reset: (widgetId: string) => void;
				remove: (widgetId: string) => void;
			};
		}
	}
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	// Props
	export let siteKey: string = '0x4AAAAAABrw4iUcnqVS_x7o'; // Testing site key as fallback
	export let theme: 'auto' | 'light' | 'dark' = 'auto';

	let widget: HTMLDivElement;
	let widgetId: string | undefined;
	let scriptLoaded = false;
	let tokenInput: HTMLInputElement | null = null;

	// Turnstile script loading
	onMount(() => {
		if (!browser) return;

		// Check if script is already loaded
		if (window.turnstile) {
			scriptLoaded = true;
			renderWidget();
			return;
		}

		// Load Turnstile script (explicit render mode to prevent auto-scanning)
		const script = document.createElement('script');
		script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
		script.async = true;
		script.defer = true;
		script.onload = () => {
			scriptLoaded = true;
			renderWidget();
		};
		script.onerror = (e) => {
			console.error('Failed to load Turnstile API script', e);
		};
		document.head.appendChild(script);

		return () => {
			// Clean up on destroy
			if (widgetId && window.turnstile) {
				try {
					window.turnstile.remove(widgetId);
				} catch (e) {
					// Ignore errors during cleanup
				}
			}
		};
	});

	function ensureTokenField() {
		// Try to find Turnstile's injected hidden input first
		const formEl = widget?.closest('form') as HTMLFormElement | null;
		if (!formEl) return null;
		const existing = formEl.querySelector(
			'input[name="cf-turnstile-response"]'
		) as HTMLInputElement | null;
		if (existing) return existing;

		// Create our own as a fallback
		const hidden = document.createElement('input');
		hidden.type = 'hidden';
		hidden.name = 'cf-turnstile-response';
		formEl.appendChild(hidden);
		return hidden;
	}

	function renderWidget() {
		if (!scriptLoaded || !widget || !window.turnstile) return;

		try {
			// Ensure token field exists (explicit render fallback)
			tokenInput = ensureTokenField();

			widgetId = window.turnstile.render(widget, {
				sitekey: siteKey,
				theme,
				size: 'normal',
				execution: 'render',
				appearance: 'interaction-only',
				callback: (token: string) => {
					// Update hidden field value
					if (!tokenInput) tokenInput = ensureTokenField();
					if (tokenInput) tokenInput.value = token;
				},
				'error-callback': (error: string) => {
					console.warn('Turnstile error:', error);
					if (tokenInput) tokenInput.value = '';
				}
			});
		} catch (error) {
			console.error('Failed to render Turnstile widget:', error);
		}
	}

	// Expose reset method
	export function reset() {
		if (widgetId && window.turnstile) {
			try {
				window.turnstile.reset(widgetId);
			} catch (error) {
				console.error('Failed to reset Turnstile widget:', error);
			}
		}
	}
</script>

<!-- Turnstile widget container -->
<div bind:this={widget} class="turnstile-widget"></div>

<!-- Global type declaration for Turnstile -->
<svelte:window on:load={renderWidget} />

<style>
	.turnstile-widget {
		display: flex;
		justify-content: center;
		margin: 1rem 0;
	}
</style>
