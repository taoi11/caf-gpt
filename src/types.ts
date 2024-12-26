// Rate Limiting Types
export interface RateWindow {
    count: number;
    timestamp: number;
}

export interface RateLimit {
    ip: string;
    hourly: RateWindow;
    daily: RateWindow;
}

// Cost Tracking Types
export interface CostData {
    apiCosts: number;        // Monthly LLM API costs in USD
    serverCosts: number;     // Monthly server costs in USD
    lastReset: string;       // YYYY-MM-DD of last monthly reset
    lastUpdated: string;     // Last update timestamp
}

// LLM Types
export type MessageRole = 'system' | 'user' | 'assistant';

export interface Message {
    role: MessageRole;
    content: string;
}

export interface LLMRequest {
    messages: Message[];
    systemPrompt?: string;
    temperature?: number;
    model?: string;  // Optional model override
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

// Pace Notes Types
export interface PaceNoteRequest {
    input: string;
    format?: 'markdown' | 'text';
}

export interface PaceNoteResponse {
    content: string;
    timestamp: string;
    format: 'markdown' | 'text';
}

// API Response Types
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

// Policy Types
export interface PolicyReference {
    docId: string;          // e.g., "5003-1"
    policyGroup?: string;   // e.g., "doad", defaults to "doad"
    section?: string;       // e.g., "5.1"
}

export interface PolicyContent {
    docTitle: string;
    section: string;
    content: string;
}

export interface PolicyDocument {
    docId: string;
    content: string;
    lastModified: Date;
    policyGroup: string;
}

export interface ChatResponse {
    answer: string;
    citations: string[];
    followUp: string;
} 