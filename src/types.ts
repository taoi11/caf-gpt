// Configuration Types
export interface CloudflareConfig {
    accountId: string;
    gatewayId: string;
    gatewayApiKey: string;
    endpoint: string;
}

export interface LLMConfig {
    provider: string;
    apiKey: string;
}

export interface S3Config {
    bucketName: string;
    accessKeyId: string;
    secretAccessKey: string;
    endpoint: string;
}

export interface ServerConfig {
    port: number;
    environment: string;
    isDev: boolean;
}

export interface AppConfig {
    cloudflare: CloudflareConfig;
    llm: LLMConfig;
    s3: S3Config;
    server: ServerConfig;
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