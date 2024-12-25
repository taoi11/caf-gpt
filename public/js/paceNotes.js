"use strict";
class PaceNotesUI {
    constructor() {
        this.maxOutputs = 5;
        this.outputs = [];
        this.outputSection = document.querySelector('.output-section');
        this.inputBox = document.querySelector('.input-box');
        this.generateButton = document.getElementById('generate-btn');
        this.formatSelect = document.getElementById('format-select');
        this.setupEventListeners();
    }
    setupEventListeners() {
        this.generateButton.addEventListener('click', () => this.handleGenerate());
        this.inputBox.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                this.handleGenerate();
            }
        });
    }
    createOutputBox(content, timestamp, isLoading = false) {
        const box = document.createElement('div');
        box.className = 'output-box';
        if (isLoading) {
            box.innerHTML = '<div class="loading">Generating pace note...</div>';
        }
        else {
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
            const copyBtn = box.querySelector('.copy-button');
            copyBtn.addEventListener('click', () => this.handleCopy(content, copyBtn));
        }
        return box;
    }
    async handleCopy(content, button) {
        try {
            await navigator.clipboard.writeText(content);
            button.textContent = 'Copied!';
            setTimeout(() => button.textContent = 'Copy', 2000);
        }
        catch (err) {
            console.error('Failed to copy:', err);
            button.textContent = 'Error';
            setTimeout(() => button.textContent = 'Copy', 2000);
        }
    }
    addOutput(content, timestamp) {
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
    async handleGenerate() {
        const input = this.inputBox.value.trim();
        if (!input) {
            this.showError('Please enter some text to generate a pace note.');
            return;
        }
        // Disable input and button during generation
        this.generateButton.disabled = true;
        this.inputBox.disabled = true;
        // Add loading box
        const loadingBox = this.createOutputBox('', new Date().toISOString(), true);
        this.outputSection.insertBefore(loadingBox, this.outputSection.firstChild);
        try {
            const request = {
                input,
                format: this.formatSelect?.value || 'text'
            };
            const response = await fetch('/api/paceNotes/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request),
            });
            const data = await response.json();
            // Remove loading box
            loadingBox.remove();
            if (data.success && data.data) {
                this.addOutput(data.data.content, data.data.timestamp);
            }
            else {
                this.showError(data.error || 'Failed to generate pace note');
            }
        }
        catch (error) {
            loadingBox.remove();
            this.showError('Failed to connect to server. Please try again.');
            console.error('Error:', error);
        }
        finally {
            this.generateButton.disabled = false;
            this.inputBox.disabled = false;
        }
    }
    showError(message) {
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
});
