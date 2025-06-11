<script lang="ts">
	// Policy Assistant page
</script>

<svelte:head>
	<title>Policy Assistant - CAF GPT</title>
	<meta name="description" content="AI-powered policy document search and question answering (Coming Soon)." />
</svelte:head>

<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
	<div class="text-center mb-12">
		<h1 class="text-4xl font-bold text-gray-900 mb-4">
			Policy Assistant
		</h1>
		<p class="text-lg text-gray-600 max-w-2xl mx-auto">
			Upload policy documents and get instant answers to your questions with AI-powered 
			search and citation support.
		</p>
	</div>

	<!-- Coming Soon Notice -->
	<div class="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center mb-8">
		<div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
			<svg class="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
			</svg>
		</div>
		<h2 class="text-xl font-semibold text-gray-900 mb-2">
			Coming Soon
		</h2>
		<p class="text-gray-600 mb-4">
			The Policy Assistant is currently in development. This module will provide intelligent 
			document search and Q&A capabilities for military policies and regulations.
		</p>
		<div class="text-sm text-gray-500">
			<p>🔧 Document processing system in development</p>
			<p>🔧 AI-powered search implementation planned</p>
			<p>🔧 Citation and source tracking coming soon</p>
		</div>
	</div>

	<!-- Planned Features -->
	<div class="grid md:grid-cols-2 gap-8 mb-8">
		<div class="bg-white border rounded-lg p-6">
			<h3 class="text-lg font-semibold text-gray-900 mb-4">
				Planned Features
			</h3>
			<div class="space-y-3">
				<div class="flex items-start">
					<div class="w-2 h-2 bg-gray-400 rounded-full mr-3 mt-2"></div>
					<div>
						<div class="font-medium text-gray-700">Document Upload</div>
						<div class="text-sm text-gray-500">Support for PDF, DOCX, and TXT files</div>
					</div>
				</div>
				<div class="flex items-start">
					<div class="w-2 h-2 bg-gray-400 rounded-full mr-3 mt-2"></div>
					<div>
						<div class="font-medium text-gray-700">Intelligent Search</div>
						<div class="text-sm text-gray-500">Natural language queries across documents</div>
					</div>
				</div>
				<div class="flex items-start">
					<div class="w-2 h-2 bg-gray-400 rounded-full mr-3 mt-2"></div>
					<div>
						<div class="font-medium text-gray-700">Citation Support</div>
						<div class="text-sm text-gray-500">Automatic source attribution and references</div>
					</div>
				</div>
			</div>
		</div>

		<div class="bg-white border rounded-lg p-6">
			<h3 class="text-lg font-semibold text-gray-900 mb-4">
				Use Cases
			</h3>
			<div class="space-y-3">
				<div class="flex items-start">
					<div class="w-2 h-2 bg-gray-400 rounded-full mr-3 mt-2"></div>
					<div>
						<div class="font-medium text-gray-700">Regulation Lookup</div>
						<div class="text-sm text-gray-500">Find specific rules and requirements</div>
					</div>
				</div>
				<div class="flex items-start">
					<div class="w-2 h-2 bg-gray-400 rounded-full mr-3 mt-2"></div>
					<div>
						<div class="font-medium text-gray-700">Procedure Guidance</div>
						<div class="text-sm text-gray-500">Step-by-step process information</div>
					</div>
				</div>
				<div class="flex items-start">
					<div class="w-2 h-2 bg-gray-400 rounded-full mr-3 mt-2"></div>
					<div>
						<div class="font-medium text-gray-700">Policy Comparison</div>
						<div class="text-sm text-gray-500">Compare requirements across documents</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Back to Home -->
	<div class="text-center">
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
