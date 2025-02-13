import { Message, MessageRole } from '../server/types.js';

// Re-export shared types
export { Message, MessageRole };

// UI-specific Types
export interface UIState {
    inputText: string;          // Only this persists on refresh
    messages: Message[];        // Cleared on refresh
    isProcessing: boolean;
}

export interface UIElements {
    userInput: HTMLTextAreaElement;
    sendButton: HTMLButtonElement;
    chatHistory: HTMLDivElement;
    policySelector?: HTMLSelectElement;
    outputBox?: HTMLDivElement;
}

// Tool-Specific Types
export interface PaceNoteRequest {
    input: string;
    rank: string;
}

export interface PaceNoteResponse {
    content: string;
    timestamp: string;
    rank: string;
} 