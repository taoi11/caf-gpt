<script lang="ts">
	// Landing page for CAF GPT
</script>

<svelte:head>
	<title>CAF GPT - AI-Powered Tools</title>
	<meta
		name="description"
		content="AI-powered tools for Canadian Armed Forces personnel including pace note generation and policy assistance."
	/>
</svelte:head>

<!-- Hero Section -->
<section class="bg-white py-20">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
		<h1 class="text-4xl md:text-6xl font-bold text-gray-900 mb-6">CAF GPT</h1>
		<p class="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
			AI-powered tools for lazy J-bros. Generate professional pace notes and get answers about CAF
			policies.
		</p>
		<div class="flex flex-col sm:flex-row gap-4 justify-center">
			<a
				href="/pacenote"
				class="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition-colors"
			>
				Try PaceNoteFoo
			</a>
			<a
				href="/policy"
				class="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-medium transition-colors"
			>
				Try PolicyFoo
			</a>
			<a
				href="#features"
				class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-8 py-3 rounded-lg font-medium transition-colors"
			>
				Learn More
			</a>
		</div>
	</div>
</section>

<!-- Features Section -->
<section id="features" class="py-20 bg-gray-50">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
		<div class="text-center mb-16">
			<h2 class="text-3xl font-bold text-gray-900 mb-4">Available Tools</h2>
			<p class="text-lg text-gray-600 max-w-2xl mx-auto">Professional AI tools for lazy J-bros.</p>
		</div>

		<div class="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
			<!-- PaceNote Module -->
			<div class="bg-white rounded-xl shadow-sm border p-8 hover:shadow-md transition-shadow">
				<div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-6">
					<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
						></path>
					</svg>
				</div>
				<h3 class="text-xl font-semibold text-gray-900 mb-4">PaceNoteFoo</h3>
				<p class="text-gray-600 mb-6">Generate good enough pacenotes for lazy J-bros.</p>
				<a
					href="/pacenote"
					class="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
				>
					Get a feedback note
					<svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"
						></path>
					</svg>
				</a>
			</div>

			<!-- Policy Module -->
			<div class="bg-white rounded-xl shadow-sm border p-8 hover:shadow-md transition-shadow">
				<div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-6">
					<svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
						></path>
					</svg>
				</div>
				<h3 class="text-xl font-semibold text-gray-900 mb-4">PolicyFoo</h3>
				<p class="text-gray-600 mb-6">
					Ask questions about CAF policies and find relevant regulations quickly.
				</p>
				<a
					href="/policy"
					class="inline-flex items-center text-green-600 hover:text-green-700 font-medium"
				>
					Ask PolicyFoo
					<svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"
						></path>
					</svg>
				</a>
			</div>
		</div>
	</div>
</section>

<!-- Technology Section -->
<section class="py-20 bg-white">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
		<h2 class="text-3xl font-bold text-gray-900 mb-8">Built on Modern Technology</h2>
		<div class="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
			<div class="text-center">
				<div
					class="w-16 h-16 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-4"
				>
					<svg class="w-8 h-8 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
						<path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
					</svg>
				</div>
				<h3 class="text-lg font-semibold text-gray-900 mb-2">Cloudflare Workers</h3>
			</div>
			<div class="text-center">
				<div class="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
					<svg class="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
						<path
							d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"
						></path>
					</svg>
				</div>
				<h3 class="text-lg font-semibold text-gray-900 mb-2">SvelteKit</h3>
			</div>
		</div>
	</div>
</section>
