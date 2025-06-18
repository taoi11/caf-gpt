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

<div class="message-list" bind:this={messagesContainer}>
	{#each messages as message, index (message.timestamp)}
		<div class="message message-{message.role}">
			<div class="message-header">
				<div class="message-role">
					{#if message.role === 'user'}
						<span class="role-icon">👤</span>
						You
					{:else}
						<span class="role-icon">🤖</span>
						Policy Assistant
					{/if}
				</div>
				<div class="message-time">
					{formatTime(message.timestamp)}
				</div>
			</div>

			<div class="message-content">
				{#if message.role === 'user'}
					<!-- User message: display as plain text -->
					<p>{message.content}</p>
				{:else}
					<!-- Assistant message: parse XML and render structured response -->
					<ResponseParser 
						xmlContent={message.content} 
						{onFollowUpClick}
						bind:parsed={message.parsed}
					/>
				{/if}
			</div>
		</div>
	{/each}

	{#if messages.length === 0}
		<div class="empty-state">
			<p>No messages yet. Start a conversation!</p>
		</div>
	{/if}
</div>

<style>
	.message-list {
		flex: 1;
		padding: 1rem;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		min-height: 400px;
		max-height: 600px;
	}

	.message {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		animation: fadeIn 0.3s ease-in-out;
	}

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

	.message-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.875rem;
		color: #6c757d;
	}

	.message-role {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 600;
	}

	.role-icon {
		font-size: 1rem;
	}

	.message-user .message-role {
		color: var(--color-theme-1);
	}

	.message-assistant .message-role {
		color: var(--color-theme-2);
	}

	.message-time {
		font-size: 0.8rem;
		opacity: 0.7;
	}

	.message-content {
		background: white;
		border-radius: 12px;
		padding: 1rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		position: relative;
	}

	.message-user .message-content {
		background: var(--color-theme-1);
		color: white;
		margin-left: 2rem;
		border-bottom-right-radius: 4px;
	}

	.message-user .message-content::after {
		content: '';
		position: absolute;
		bottom: 0;
		right: -8px;
		width: 0;
		height: 0;
		border: 8px solid transparent;
		border-left-color: var(--color-theme-1);
		border-bottom: none;
		border-top: none;
	}

	.message-assistant .message-content {
		background: #f8f9fa;
		margin-right: 2rem;
		border-bottom-left-radius: 4px;
		border: 1px solid #e9ecef;
	}

	.message-assistant .message-content::after {
		content: '';
		position: absolute;
		bottom: 0;
		left: -8px;
		width: 0;
		height: 0;
		border: 8px solid transparent;
		border-right-color: #f8f9fa;
		border-bottom: none;
		border-top: none;
	}

	.message-content p {
		margin: 0;
		line-height: 1.5;
	}

	.empty-state {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #6c757d;
		font-style: italic;
	}

	.empty-state p {
		margin: 0;
		text-align: center;
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		.message-list {
			padding: 0.75rem;
			gap: 1rem;
		}

		.message-user .message-content {
			margin-left: 1rem;
		}

		.message-assistant .message-content {
			margin-right: 1rem;
		}

		.message-content {
			padding: 0.75rem;
		}

		.message-header {
			font-size: 0.8rem;
		}
	}

	/* Scrollbar styling */
	.message-list::-webkit-scrollbar {
		width: 6px;
	}

	.message-list::-webkit-scrollbar-track {
		background: #f1f1f1;
		border-radius: 3px;
	}

	.message-list::-webkit-scrollbar-thumb {
		background: #c1c1c1;
		border-radius: 3px;
	}

	.message-list::-webkit-scrollbar-thumb:hover {
		background: #a8a8a8;
	}
</style>
