<script lang="ts">
	// PaceNote Generator page
</script>

<svelte:head>
	<title>PaceNote Generator - CAF GPT</title>
	<meta name="description" content="Generate professional pace notes using AI with rank-specific competency frameworks." />
</svelte:head>

<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
	<div class="text-center mb-12">
		<h1 class="text-4xl font-bold text-gray-900 mb-4">
			PaceNote Generator
		</h1>
		<p class="text-lg text-gray-600 max-w-2xl mx-auto">
			Generate professional pace notes using AI with rank-specific competency frameworks 
			and structured feedback templates.
		</p>
	</div>

	<!-- Coming Soon Notice -->
	<div class="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center mb-8">
		<div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
			<svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path>
			</svg>
		</div>
		<h2 class="text-xl font-semibold text-blue-900 mb-2">
			Interface Under Development
		</h2>
		<p class="text-blue-700 mb-4">
			The PaceNote generator backend is ready! We're currently building the user interface.
		</p>
		<div class="text-sm text-blue-600">
			<p>✅ AI model integration complete</p>
			<p>✅ Rank-specific competency templates ready</p>
			<p>🔧 User interface in development</p>
		</div>
	</div>

	<!-- Feature Preview -->
	<div class="grid md:grid-cols-2 gap-8">
		<div class="bg-white border rounded-lg p-6">
			<h3 class="text-lg font-semibold text-gray-900 mb-4">
				Supported Ranks
			</h3>
			<div class="space-y-2">
				<div class="flex items-center">
					<div class="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
					<span class="text-gray-700">Corporal (Cpl)</span>
				</div>
				<div class="flex items-center">
					<div class="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
					<span class="text-gray-700">Master Corporal (MCpl)</span>
				</div>
				<div class="flex items-center">
					<div class="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
					<span class="text-gray-700">Sergeant (Sgt)</span>
				</div>
				<div class="flex items-center">
					<div class="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
					<span class="text-gray-700">Warrant Officer (WO)</span>
				</div>
			</div>
		</div>

		<div class="bg-white border rounded-lg p-6">
			<h3 class="text-lg font-semibold text-gray-900 mb-4">
				Key Features
			</h3>
			<div class="space-y-2">
				<div class="flex items-center">
					<div class="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
					<span class="text-gray-700">AI-powered generation</span>
				</div>
				<div class="flex items-center">
					<div class="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
					<span class="text-gray-700">Competency-based feedback</span>
				</div>
				<div class="flex items-center">
					<div class="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
					<span class="text-gray-700">Professional formatting</span>
				</div>
				<div class="flex items-center">
					<div class="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
					<span class="text-gray-700">Copy-to-clipboard output</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Back to Home -->
	<div class="text-center mt-12">
		<a 
			href="/" 
			class="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
		>
			<svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
			</svg>
			Back to Home
		</a>
	</div>
</div>
