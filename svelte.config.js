import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			// Enable automatic type generation from wrangler.jsonc
			config: 'wrangler.jsonc'
		}),
		// Fix 403 CSRF errors in development with Cloudflare Workers
		csrf: {
			checkOrigin: process.env.NODE_ENV === 'production'
		}
	}
};

export default config;
