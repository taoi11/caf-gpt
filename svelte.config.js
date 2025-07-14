import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
	preprocess: vitePreprocess(),
	kit: { 
		adapter: adapter({
			// Enable automatic type generation from wrangler.jsonc
			config: 'wrangler.jsonc'
		})
	}
};

export default config;
