// Message Types (shared between client and server)
export type MessageRole = 'user' | 'assistant';

export interface Message {
    role: MessageRole;
    content: string;
    timestamp: string;
}

// Server-specific message types
export interface SystemMessage {
    role: 'system';
    content: string;
}

export interface LLMMessage extends Message {
    metadata?: {
        model?: string;
        tokens?: number;
    }
}

// API Types
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

// LLM Core Types
export interface LLMRequest {
    messages: Message[];
    systemPrompt?: string;      // Separate system prompt from conversation
    temperature?: number;
    model?: string;
    maxContextLength?: number;
}

export interface LLMResponse {
    content: string;
    model: string;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export interface LLMError {
    code: string;
    message: string;
    type: 'rate_limit' | 'invalid_request' | 'api_error' | 'connection_error';
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

// Policy Types
export interface PolicyDocument {
    docId: string;
    content: string;
    lastModified: Date;
    policyGroup: string;
}

// PaceNote Types
export interface PaceNoteRequest {
    input: string;
    rank: string;
}

export interface PaceNoteResponse {
    content: string;
    timestamp: string;
    rank: string;
}

// Types for LLM logging
export type LLMInteractionData = {
    role: 'system' | 'user' | 'assistant'
    content: string
    metadata?: {
        model?: string
        usage?: {
            prompt_tokens?: number
            completion_tokens?: number
            total_tokens?: number
        }
        timestamp?: string
        conversationId?: string
    }
} 