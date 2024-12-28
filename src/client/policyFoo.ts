import { parseDOADResponse } from './doadFoo.js';
import { rateLimiter } from './utils/rateLimiter.js';

// Types
interface ChatResponse {
    answer: string;
    citations: string[];
    followUp: string;
}

interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

// DOM Elements
const userInput = document.getElementById('user-input') as HTMLTextAreaElement;
const sendButton = document.getElementById('send-button') as HTMLButtonElement;
const chatHistory = document.getElementById('chat-history') as HTMLDivElement;
const policySelector = document.getElementById('policy-selector') as HTMLSelectElement;

// Chat state
let conversationHistory: { role: string; content: string; }[] = [];

// Message handling
async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    try {
        // Disable input while processing
        userInput.disabled = true;
        sendButton.disabled = true;

        // Add user message to UI
        appendMessage('user', message);
        userInput.value = '';

        // Send to backend
        const response = await fetch('/api/policyfoo/doad/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tool: policySelector.value,
                message,
                conversationHistory
            })
        });

        const result = await response.json() as ApiResponse<ChatResponse>;

        if (!result.success || !result.data) {
            throw new Error(result.error || 'Failed to get response');
        }

        // Add assistant response to UI
        appendMessage('assistant', result.data.answer, result.data.citations);
        
        // Update rate limits after successful request
        await rateLimiter.forceUpdate();

        // Update conversation history
        conversationHistory.push(
            { role: 'user', content: message },
            { role: 'assistant', content: result.data.answer }
        );

        // Add follow-up if present
        if (result.data.followUp) {
            appendFollowUp(result.data.followUp);
        }

    } catch (error) {
        console.error('Error:', error);
        appendErrorMessage(error instanceof Error ? error.message : 'An error occurred');
    } finally {
        userInput.disabled = false;
        sendButton.disabled = false;
    }
}

// UI Helpers
function appendMessage(role: 'user' | 'assistant', content: string, citations?: string[]) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;
    
    if (role === 'assistant') {
        // Parse DOAD response
        const parsed = parseDOADResponse(content);
        
        // Main answer
        const contentP = document.createElement('p');
        contentP.textContent = parsed.answer;
        messageDiv.appendChild(contentP);

        // Citations if any
        if (parsed.citations.length) {
            const citationsDiv = document.createElement('div');
            citationsDiv.className = 'citations';
            citationsDiv.textContent = `Referenced sections: ${parsed.citations.join(', ')}`;
            messageDiv.appendChild(citationsDiv);
        }
    } else {
        // User message - no parsing needed
        const contentP = document.createElement('p');
        contentP.textContent = content;
        messageDiv.appendChild(contentP);
    }

    chatHistory.appendChild(messageDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function appendFollowUp(followUp: string) {
    const followUpDiv = document.createElement('div');
    followUpDiv.className = 'follow-up';
    followUpDiv.textContent = `Suggested follow-up: ${followUp}`;
    followUpDiv.onclick = () => {
        userInput.value = followUp;
        userInput.focus();
    };
    chatHistory.appendChild(followUpDiv);
}

function appendErrorMessage(error: string) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'message error-message';
    errorDiv.textContent = `Error: ${error}`;
    chatHistory.appendChild(errorDiv);
}

// Event Listeners
sendButton.onclick = sendMessage;

userInput.onkeydown = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
    }
};

// Initial setup
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize the singleton once
    rateLimiter;
}); 