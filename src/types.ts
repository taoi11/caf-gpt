// Rate Limiting Types
export interface RequestWindow {
    count: number;
    timestamp: number;
}

export interface RateLimitInfo {
    hourly: RequestWindow;
    daily: RequestWindow;
}

// Cost Tracking Types
export interface CostData {
    monthlyTotal: number;    // In USD (excluding server cost)
    lastReset: string;       // YYYY-MM-DD of last monthly reset
    lastUpdated: string;
    requests: {
        id: string;
        timestamp: string;
        model: string;
        cost: number;        // In USD
        tokens: {
            prompt: number;
            completion: number;
            total: number;
        };
    }[];
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