import tailwindcss from '@tailwindcss/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	test: {
		projects: [
			{
				plugins: [tailwindcss(), sveltekit(), svelteTesting()],
				test: {
					name: 'client',
					environment: 'jsdom',
					globals: true,
					clearMocks: true,
					include: [
						'src/**/*.svelte.{test,spec}.{js,ts}',
						'src/routes/__tests__/**/*.test.{js,ts}',
						'src/lib/components/**/*.test.{js,ts}'
					],
					exclude: ['src/lib/server/**'],
					setupFiles: ['./vitest-setup-client.ts']
				}
			},
			{
				test: {
					name: 'server',
					environment: 'node',
					globals: true,
					include: ['src/lib/server/**/*.{test,spec}.{js,ts}', 'src/routes/api/**/*.test.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			},
			{
				test: {
					name: 'integration',
					environment: 'node',
					globals: true,
					include: ['tests/integration/**/*.{test,spec}.{js,ts}'],
					testTimeout: 30000
				}
			}
		]
	}
});
