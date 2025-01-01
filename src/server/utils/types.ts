// Message Types (shared between client and server)
export type MessageRole = 'user' | 'system' | 'assistant';

export interface Message {
    role: MessageRole;
    content: string;
    timestamp?: string;
}

export interface ConversationHistory {
    messages: Message[];
    lastUpdated?: string;
}

// Infrastructure Types
export interface RateWindow {
    count: number;
    timestamp: number;
}

export interface RateLimit {
    ip: string;
    hourly: RateWindow;
    daily: RateWindow;
}

export interface CostData {
    apiCosts: number;        // Monthly LLM API costs in USD
    serverCosts: number;     // Monthly server costs in USD
    lastReset: string;       // YYYY-MM-DD of last monthly reset
    lastUpdated: string;     // Last update timestamp
}

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

// LLM Core Types
export interface LLMRequest {
    messages: Message[];
    systemPrompt?: string;
    temperature?: number;
    model?: string;
    maxContextLength?: number;
}

export interface LLMResponse {
    content: string;
    model: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

export interface LLMError {
    code: string;
    message: string;
    type: 'rate_limit' | 'invalid_request' | 'api_error' | 'connection_error';
}

// PaceNote Types
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

// Add DisplayOptions to shared types
export interface DisplayOptions {
    timestamp?: boolean;
    showCitations?: boolean;
    showFollowUp?: boolean;
    format?: 'markdown' | 'text';
} 