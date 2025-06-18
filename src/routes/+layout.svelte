<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<div class="min-h-screen bg-gray-50">
	<nav class="bg-white shadow-sm border-b">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="flex justify-between h-16">
				<div class="flex items-center">
					<a href="/" class="text-xl font-bold text-gray-900">
						CAF GPT
					</a>
				</div>
				<div class="flex items-center space-x-8">
					<a href="/pacenote" class="text-gray-600 hover:text-gray-900 transition-colors">
						PaceNote
					</a>
					<a href="/policy" class="text-gray-600 hover:text-gray-900 transition-colors">
						Policy
					</a>
				</div>
			</div>
		</div>
	</nav>

	<main>
		{@render children()}
	</main>

	<footer class="bg-white border-t mt-auto">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
			<div class="text-center text-gray-500 text-sm">
				<p>CAF GPT - AI-Powered Tools</p>
				<p class="mt-2">Powered by Cloudflare Workers</p>
			</div>
		</div>
	</footer>
</div>
