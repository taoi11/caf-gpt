class RateLimitDisplay {
    constructor() {
        this.updateInterval = 5000; // 5 seconds
        this.initialize();
    }
    initialize() {
        // Update immediately and start interval
        this.updateLimits();
        setInterval(() => this.updateLimits(), this.updateInterval);
    }
    formatTime(ms) {
        const minutes = Math.floor(ms / 60000);
        if (minutes < 1)
            return 'soon';
        return `${minutes}m`;
    }
    formatLimit(info) {
        return `${info.remaining} messages`;
    }
    async updateLimits() {
        try {
            const response = await fetch('/api/ratelimit');
            const data = await response.json();
            // Update breakdown directly
            document.querySelector('.hourly-remaining').textContent = this.formatLimit(data.hourly);
            document.querySelector('.daily-remaining').textContent = this.formatLimit(data.daily);
        }
        catch (error) {
            console.error('Failed to fetch rate limits:', error);
            document.querySelector('.hourly-remaining').textContent = 'Error';
            document.querySelector('.daily-remaining').textContent = 'Error';
        }
    }
}
class PolicyFooUI {
    constructor() {
        this.isProcessing = false;
        this.conversationHistory = [];
        // Initialize DOM elements
        this.chatHistory = document.getElementById('chat-history');
        this.userInput = document.getElementById('user-input');
        this.sendButton = document.getElementById('send-button');
        this.setupEventListeners();
    }
    setupEventListeners() {
        this.userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.handleSubmit();
            }
        });
        this.sendButton.addEventListener('click', () => this.handleSubmit());
    }
    addMessage(content, isUser) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
        messageDiv.textContent = content;
        this.chatHistory.appendChild(messageDiv);
        this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
    }
    addAIResponse(response) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai-message';
        // Main answer
        const answerP = document.createElement('p');
        answerP.textContent = response.answer;
        messageDiv.appendChild(answerP);
        // Citations
        if (response.citations.length > 0) {
            const citationsDiv = document.createElement('div');
            citationsDiv.className = 'citations';
            citationsDiv.textContent = 'References: ' + response.citations.join(', ');
            messageDiv.appendChild(citationsDiv);
        }
        // Follow-up
        if (response.followUp) {
            const followUpDiv = document.createElement('div');
            followUpDiv.className = 'follow-up';
            followUpDiv.textContent = response.followUp;
            messageDiv.appendChild(followUpDiv);
        }
        this.chatHistory.appendChild(messageDiv);
        this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
    }
    async handleSubmit() {
        if (this.isProcessing || !this.userInput.value.trim())
            return;
        const message = this.userInput.value.trim();
        this.userInput.value = '';
        this.isProcessing = true;
        this.sendButton.disabled = true;
        try {
            this.addMessage(message, true);
            this.conversationHistory.push(message);
            const response = await fetch('/api/policyfoo/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: message,
                    conversation_history: this.conversationHistory
                })
            });
            if (!response.ok) {
                throw new Error('Failed to get response');
            }
            const data = await response.json();
            this.addAIResponse(data);
        }
        catch (error) {
            console.error('Error:', error);
            this.addMessage('Sorry, there was an error processing your request. Please try again.', false);
        }
        finally {
            this.isProcessing = false;
            this.sendButton.disabled = false;
        }
    }
}
// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PolicyFooUI();
    new RateLimitDisplay();
});
export {};
