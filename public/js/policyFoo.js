import { parseDOADResponse } from './doadFoo.js';
// DOM Elements
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const chatHistory = document.getElementById('chat-history');
const policySelector = document.getElementById('policy-selector');
// Rate limit display elements
const hourlyRemaining = document.querySelector('.hourly-remaining');
const dailyRemaining = document.querySelector('.daily-remaining');
// Chat state
let conversationHistory = [];
// Message handling
async function sendMessage() {
    const message = userInput.value.trim();
    if (!message)
        return;
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
        const result = await response.json();
        if (!result.success || !result.data) {
            throw new Error(result.error || 'Failed to get response');
        }
        // Add assistant response to UI
        appendMessage('assistant', result.data.answer, result.data.citations);
        // Update conversation history
        conversationHistory.push({ role: 'user', content: message }, { role: 'assistant', content: result.data.answer });
        // Update rate limits
        updateRateLimits();
        // Add follow-up if present
        if (result.data.followUp) {
            appendFollowUp(result.data.followUp);
        }
    }
    catch (error) {
        console.error('Error:', error);
        appendErrorMessage(error instanceof Error ? error.message : 'An error occurred');
    }
    finally {
        userInput.disabled = false;
        sendButton.disabled = false;
    }
}
// UI Helpers
function appendMessage(role, content, citations) {
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
    }
    else {
        // User message - no parsing needed
        const contentP = document.createElement('p');
        contentP.textContent = content;
        messageDiv.appendChild(contentP);
    }
    chatHistory.appendChild(messageDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}
function appendFollowUp(followUp) {
    const followUpDiv = document.createElement('div');
    followUpDiv.className = 'follow-up';
    followUpDiv.textContent = `Suggested follow-up: ${followUp}`;
    followUpDiv.onclick = () => {
        userInput.value = followUp;
        userInput.focus();
    };
    chatHistory.appendChild(followUpDiv);
}
function appendErrorMessage(error) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'message error-message';
    errorDiv.textContent = `Error: ${error}`;
    chatHistory.appendChild(errorDiv);
}
async function updateRateLimits() {
    try {
        const response = await fetch('/api/ratelimit');
        const limits = await response.json();
        hourlyRemaining.textContent = `${limits.hourly.remaining} messages`;
        dailyRemaining.textContent = `${limits.daily.remaining} messages`;
    }
    catch (error) {
        console.error('Failed to update rate limits:', error);
        hourlyRemaining.textContent = 'Error';
        dailyRemaining.textContent = 'Error';
    }
}
// Event Listeners
sendButton.onclick = sendMessage;
userInput.onkeydown = (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
    }
};
// Initial setup
updateRateLimits();
