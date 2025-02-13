import { parseDOADResponse } from './doadFoo.js';
import { rateLimiter } from './utils/rateLimiter.js';
import { Message, UIState, UIElements } from './types.js';
import { ChatResponse } from '../server/api/policyFoo/doad/types.js';

// Types
interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

// Constants
const SESSION_KEY = 'policyFoo_input';
const MAX_MESSAGES = 50;

// UI State
const state: UIState = {
    inputText: sessionStorage.getItem(SESSION_KEY) || '',
    messages: [],
    isProcessing: false
};

// DOM Elements
const userInput = document.getElementById('user-input') as HTMLTextAreaElement;
const sendButton = document.getElementById('send-button') as HTMLButtonElement;
const chatHistory = document.getElementById('chat-history') as HTMLDivElement;
const policySelector = document.getElementById('policy-selector') as HTMLSelectElement;

// Message handling
async function sendMessage() {
    const message = state.inputText.trim();
    if (!message || state.isProcessing) return;

    try {
        state.isProcessing = true;
        updateUI();

        // Add user message to UI and state
        const userMessage: Message = {
            role: 'user',
            content: message,
            timestamp: new Date().toISOString()
        };
        
        appendMessage('user', message);
        state.messages.push(userMessage);
        
        // Clear input
        state.inputText = '';
        sessionStorage.setItem(SESSION_KEY, '');
        updateUI();

        // Send to backend with recent messages
        const response = await fetch('/api/policyfoo/doad/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tool: policySelector.value,
                message,
                conversationHistory: state.messages.slice(-10) // Keep last 10 messages
            })
        });

        const result = await response.json() as ApiResponse<ChatResponse>;

        if (!result.success || !result.data) {
            throw new Error(result.error || 'Failed to get response');
        }

        // Add assistant response to UI and state
        const assistantMessage: Message = {
            role: 'assistant',
            content: result.data.answer,
            timestamp: new Date().toISOString()
        };
        
        appendMessage('assistant', result.data.answer, result.data.citations);
        state.messages.push(assistantMessage);

        // Limit message history
        if (state.messages.length > MAX_MESSAGES) {
            state.messages = state.messages.slice(-MAX_MESSAGES);
            chatHistory.innerHTML = '';
            state.messages.forEach(msg => 
                appendMessage(msg.role as 'user' | 'assistant', msg.content)
            );
        }
        
        // Update rate limits after each message
        await rateLimiter.updateLimits();

        if (result.data.followUp) {
            appendFollowUp(result.data.followUp);
        }

    } catch (error) {
        console.error('Error:', error);
        appendErrorMessage(error instanceof Error ? error.message : 'An error occurred');
    } finally {
        state.isProcessing = false;
        updateUI();
    }
}

// UI Helpers
function updateUI() {
    userInput.value = state.inputText;
    userInput.disabled = state.isProcessing;
    sendButton.disabled = state.isProcessing;
}

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
        state.inputText = followUp;
        sessionStorage.setItem(SESSION_KEY, followUp);
        updateUI();
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

userInput.oninput = () => {
    state.inputText = userInput.value;
    sessionStorage.setItem(SESSION_KEY, state.inputText);
};

// Initial setup
document.addEventListener('DOMContentLoaded', async () => {
    updateUI();
    await rateLimiter.initializeDisplay();
}); 