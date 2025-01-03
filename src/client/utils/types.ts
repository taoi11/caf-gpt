import { Message, MessageRole, DisplayOptions } from '../../server/utils/types.js';

// Re-export shared types
export { Message, MessageRole, DisplayOptions };

// UI-specific Types
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
    options?: DisplayOptions;
}

export interface PaceNoteResponse {
    content: string;
    timestamp: string;
    rank: string;
} 