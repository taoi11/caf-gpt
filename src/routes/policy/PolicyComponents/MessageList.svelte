<script lang="ts">
	import ResponseParser from './ResponseParser.svelte';

	export let messages: Array<{
		role: 'user' | 'assistant';
		content: string;
		timestamp: number;
		parsed?: {
			answer: string;
			citations: string[];
			follow_up?: string;
		};
	}>;

	export let onFollowUpClick: (question: string) => void;

	/**
	 * Format timestamp for display
	 */
	function formatTime(timestamp: number): string {
		return new Date(timestamp).toLocaleTimeString([], {
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	/**
	 * Scroll to bottom when new messages arrive
	 */
	let messagesContainer: HTMLElement;
	$: if (messages.length && messagesContainer) {
		setTimeout(() => {
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
		}, 100);
	}
</script>

<div
	class="message-list flex-1 p-4 overflow-y-auto flex flex-col gap-6 md:max-h-[50vh] lg:max-h-[60vh]"
	bind:this={messagesContainer}
>
	{#each messages as message, index (message.timestamp)}
		<div class="flex flex-col gap-2 animate-fade-in">
			<div class="flex justify-between items-center text-sm text-gray-500">
				<div class="flex items-center gap-2 font-semibold">
					{#if message.role === 'user'}
						<span class="text-base">👤</span>
						<span class="text-blue-600">You</span>
					{:else}
						<span class="text-base">🤖</span>
						<span class="text-gray-700">Policy Assistant</span>
					{/if}
				</div>
				<div class="text-xs opacity-70">
					{formatTime(message.timestamp)}
				</div>
			</div>

			<div class="relative">
				{#if message.role === 'user'}
					<!-- User message: display as plain text -->
					<div class="bg-blue-600 text-white rounded-xl rounded-br-sm p-4 ml-8 shadow-sm relative">
						<p class="m-0 leading-relaxed">{message.content}</p>
						<div
							class="absolute bottom-0 right-[-8px] w-0 h-0 border-l-8 border-l-blue-600 border-t-8 border-t-transparent"
						></div>
					</div>
				{:else}
					<!-- Assistant message: parse XML and render structured response -->
					<div
						class="bg-gray-50 rounded-xl rounded-bl-sm p-4 mr-8 shadow-sm border border-gray-200 relative"
					>
						<ResponseParser
							xmlContent={message.content}
							{onFollowUpClick}
							bind:parsed={message.parsed}
						/>
						<div
							class="absolute bottom-0 left-[-8px] w-0 h-0 border-r-8 border-r-gray-50 border-t-8 border-t-transparent"
						></div>
					</div>
				{/if}
			</div>
		</div>
	{/each}

	{#if messages.length === 0}
		<div class="flex-1 flex items-center justify-center text-gray-500 italic">
			<p class="m-0 text-center">No messages yet. Start a conversation!</p>
		</div>
	{/if}
</div>

<style>
	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.animate-fade-in {
		animation: fadeIn 0.3s ease-in-out;
	}

	/* Custom scrollbar styling */
	.message-list::-webkit-scrollbar {
		width: 6px;
	}

	.message-list::-webkit-scrollbar-track {
		background: #f3f4f6;
		border-radius: 3px;
	}

	.message-list::-webkit-scrollbar-thumb {
		background: #d1d5db;
		border-radius: 3px;
	}

	.message-list::-webkit-scrollbar-thumb:hover {
		background: #9ca3af;
	}
</style>
