// Types
interface OutputBox {
    element: HTMLDivElement;
    timestamp: string;
}

interface PaceNoteRequest {
    input: string;
    rank: string;
}

interface PaceNoteResponse {
    content: string;
    timestamp: string;
    rank: string;
}

interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

import { rateLimiter } from './utils/rateLimiter.js';

class PaceNotesUI {
    private readonly outputSection: HTMLElement;
    private readonly maxOutputs: number = 5;
    private readonly outputs: OutputBox[] = [];
    private readonly inputBox: HTMLTextAreaElement;
    private readonly generateButton: HTMLButtonElement;
    private readonly rankSelect: HTMLSelectElement;

    constructor() {
        this.outputSection = document.querySelector('.output-section')!;
        this.inputBox = document.querySelector('.input-box')!;
        this.generateButton = document.getElementById('generate-btn') as HTMLButtonElement;
        this.rankSelect = document.getElementById('rank-select') as HTMLSelectElement;
        
        this.setupEventListeners();
        
        // Initialize rate limit display
        rateLimiter.initializeDisplay().catch(console.error);
    }

    private setupEventListeners(): void {
        this.generateButton.addEventListener('click', () => this.handleGenerate());
        this.inputBox.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                this.handleGenerate();
            }
        });
        this.rankSelect.addEventListener('change', () => {
            this.generateButton.disabled = !this.rankSelect.value;
        });
    }

    private createOutputBox(content: string, timestamp: string, isLoading = false): HTMLDivElement {
        const box = document.createElement('div');
        box.className = 'output-box';
        
        if (isLoading) {
            box.innerHTML = '<div class="loading">Generating pace note...</div>';
        } else {
            box.innerHTML = `
                <div class="output-content">
                    <pre class="response-text">${content}</pre>
                    <div class="output-meta">
                        <span class="timestamp">${new Date(timestamp).toLocaleString()}</span>
                        <button class="copy-button" aria-label="Copy to clipboard">
                            Copy
                        </button>
                    </div>
                </div>
            `;

            const copyBtn = box.querySelector('.copy-button')!;
            copyBtn.addEventListener('click', () => this.handleCopy(content, copyBtn));
        }

        return box;
    }

    private async handleCopy(content: string, button: Element): Promise<void> {
        try {
            await navigator.clipboard.writeText(content);
            button.textContent = 'Copied!';
            setTimeout(() => button.textContent = 'Copy', 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
            button.textContent = 'Error';
            setTimeout(() => button.textContent = 'Copy', 2000);
        }
    }

    private addOutput(content: string, timestamp: string): void {
        // Remove oldest output if we have too many
        if (this.outputs.length >= this.maxOutputs) {
            const oldest = this.outputs.shift();
            oldest?.element.remove();
        }

        const box = this.createOutputBox(content, timestamp);
        this.outputSection.insertBefore(box, this.outputSection.firstChild);
        this.outputs.push({
            element: box,
            timestamp
        });
    }

    private async handleGenerate(): Promise<void> {
        const input = this.inputBox.value.trim();
        const rank = this.rankSelect.value;

        if (!input) {
            this.showError('Please enter some text to generate a pace note.');
            return;
        }

        if (!rank) {
            this.showError('Please select a rank before generating.');
            return;
        }

        // Disable input and button during generation
        this.generateButton.disabled = true;
        this.inputBox.disabled = true;
        this.rankSelect.disabled = true;

        // Add loading box
        const loadingBox = this.createOutputBox('', new Date().toISOString(), true);
        this.outputSection.insertBefore(loadingBox, this.outputSection.firstChild);

        try {
            const request: PaceNoteRequest = {
                input,
                rank
            };

            const response = await fetch('/api/paceNotes/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request),
            });

            const data: ApiResponse<PaceNoteResponse> = await response.json();
            
            // Remove loading box
            loadingBox.remove();
            
            if (data.success && data.data) {
                this.addOutput(data.data.content, data.data.timestamp);
                // Update rate limits after successful generation
                await rateLimiter.updateLimits();
            } else {
                this.showError(data.error || 'Failed to generate pace note');
            }
        } catch (error) {
            loadingBox.remove();
            this.showError('Failed to connect to server. Please try again.');
            console.error('Error:', error);
        } finally {
            this.generateButton.disabled = !this.rankSelect.value;
            this.inputBox.disabled = false;
            this.rankSelect.disabled = false;
        }
    }

    private showError(message: string): void {
        const errorBox = document.createElement('div');
        errorBox.className = 'error-message';
        errorBox.textContent = message;
        
        this.outputSection.insertBefore(errorBox, this.outputSection.firstChild);
        setTimeout(() => errorBox.remove(), 5000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PaceNotesUI();
    // Only initialize the singleton once
    rateLimiter;
}); 