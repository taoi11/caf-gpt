import type { ChatResponse } from '../types';

// Types
interface RateLimitInfo {
    hourly: {
        remaining: number;
        resetIn: number;
    };
    daily: {
        remaining: number;
        resetIn: number;
    };
}

class RateLimitDisplay {
    private readonly updateInterval = 5000; // 5 seconds

    constructor() {
        this.initialize();
    }

    private initialize(): void {
        // Update immediately and start interval
        this.updateLimits();
        setInterval(() => this.updateLimits(), this.updateInterval);
    }

    private formatTime(ms: number): string {
        const minutes = Math.floor(ms / 60000);
        if (minutes < 1) return 'soon';
        return `${minutes}m`;
    }

    private formatLimit(info: { remaining: number; resetIn: number }): string {
        return `${info.remaining} messages`;
    }

    private async updateLimits(): Promise<void> {
        try {
            const response = await fetch('/api/ratelimit');
            const data: RateLimitInfo = await response.json();
            
            // Update breakdown directly
            document.querySelector('.hourly-remaining')!.textContent = this.formatLimit(data.hourly);
            document.querySelector('.daily-remaining')!.textContent = this.formatLimit(data.daily);
        } catch (error) {
            console.error('Failed to fetch rate limits:', error);
            document.querySelector('.hourly-remaining')!.textContent = 'Error';
            document.querySelector('.daily-remaining')!.textContent = 'Error';
        }
    }
}

class PolicyFooUI {
    private readonly chatHistory: HTMLDivElement;
    private readonly userInput: HTMLTextAreaElement;
    private readonly sendButton: HTMLButtonElement;
    private isProcessing = false;
    private readonly conversationHistory: string[] = [];

    constructor() {
        // Initialize DOM elements
        this.chatHistory = document.getElementById('chat-history') as HTMLDivElement;
        this.userInput = document.getElementById('user-input') as HTMLTextAreaElement;
        this.sendButton = document.getElementById('send-button') as HTMLButtonElement;

        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        this.userInput.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.handleSubmit();
            }
        });

        this.sendButton.addEventListener('click', () => this.handleSubmit());
    }

    private addMessage(content: string, isUser: boolean): void {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
        messageDiv.textContent = content;
        this.chatHistory.appendChild(messageDiv);
        this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
    }

    private addAIResponse(response: ChatResponse): void {
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

    private async handleSubmit(): Promise<void> {
        if (this.isProcessing || !this.userInput.value.trim()) return;

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

            const data: ChatResponse = await response.json();
            this.addAIResponse(data);

        } catch (error) {
            console.error('Error:', error);
            this.addMessage('Sorry, there was an error processing your request. Please try again.', false);
        } finally {
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