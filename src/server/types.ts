// Server Types - Consolidated Types for the Server Module
import { IncomingMessage, ServerResponse } from 'http';

// ----------
// Message Types (shared between client and server)
// ----------
export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
    role: MessageRole;
    content: string;
    timestamp: string;
}

export interface SystemMessage {
    role: 'system';
    content: string;
}

// ----------
// API Response Types
// ----------
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

// ----------
// HTTP & Server Related Types
// ----------
export interface PolicyHandler {
    handleMessage(
        message: string, 
        history?: Message[], 
        req?: IncomingMessage
    ): Promise<ChatResponse>;
}

export interface PolicyRouter {
    handleRequest(
        tool: PolicyTool,
        message: string,
        history?: Message[],
        req?: IncomingMessage
    ): Promise<ApiResponse<ChatResponse>>;
}

// ----------
// Logging Types
// ----------
export interface LogEntry {
    timestamp: string;
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
    message: string;
    metadata?: {
        requestId?: string;
        [key: string]: any;
    };
}

export interface LLMInteractionData {
    role: MessageRole;
    content: string;
    metadata?: {
        model?: string;
        usage?: {
            prompt_tokens?: number;
            completion_tokens?: number;
            total_tokens?: number;
        };
        timestamp?: string;
        type?: 'request' | 'response';
        agent?: 'finder' | 'chat';
        temperature?: number;
        conversationId?: string;
        [key: string]: any;
    };
}

export interface DOADLogger {
    logAgentInteraction(type: 'finder' | 'chat', data: LLMInteractionData): void;
    logAgentError(type: 'finder' | 'chat', error: Error, metadata?: Record<string, any>): void;
}

// ----------
// LLM Core Types
// ----------
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

// ----------
// Rate Limiting Types
// ----------
export interface RateWindow {
    timestamps: number[];  // Array of request timestamps in milliseconds
}

export interface RateLimit {
    ip: string;
    hourly: RateWindow;
    daily: RateWindow;
    lastCleanup: number;  // Track last cleanup time
}

export interface RateLimitInfo {
    hourly: { remaining: number; resetIn: number };
    daily: { remaining: number; resetIn: number };
}

export interface NodeRateLimiter {
    canMakeRequest(req: IncomingMessage): boolean | Promise<boolean>;
    trackSuccessfulRequest(req: IncomingMessage): void;
    getLimitInfo(req: IncomingMessage): any;
    sendLimitResponse(req: IncomingMessage, res: ServerResponse, type: string): void;
}

// ----------
// Cost Tracking Types
// ----------
export interface CostData {
    apiCosts: number;        // Monthly LLM API costs in USD
    serverCosts: number;     // Monthly server costs in USD
    lastReset: string;       // YYYY-MM-DD of last monthly reset
    lastUpdated: string;     // Last update timestamp
}

// ----------
// Policy Types
// ----------
export type PolicyTool = 'doadFoo';

export interface PolicyRequest {
    tool: PolicyTool;
    message: string;
    conversationHistory?: Message[];
}

export interface PolicyDocument {
    docId: string;
    content: string;
    lastModified: Date;
    policyGroup: string;
}

// ----------
// DOAD Types
// ----------
export interface PolicyReference {
    docId: string;          // DOAD number (e.g., "10001-1")
    section?: string;       // Policy section (e.g., "5.1")
}

export interface ChatResponse {
    answer: string;         // Main response to user
    citations: string[];    // List of DOAD references used
    followUp?: string;      // Optional follow-up suggestions
}

export interface DOADHandler {
    getDOADPath(doadNumber: string): string;
    isValidDOADNumber(doadNumber: string): boolean;
    extractDOADNumbers(text: string): string[];
    validateRequest(message: string): boolean;
    formatResponse(response: ChatResponse): ChatResponse;
    getDOADContent(doadNumber: string): Promise<string>;
}

export interface DOADFinder extends DOADHandler {
    handleMessage(message: string, history?: Message[]): Promise<string[]>;
    logAgentError(type: 'finder', error: Error, metadata?: Record<string, any>): void;
}

export interface DOADChat {
    handleMessage(
        message: string,
        userHistory: Message[],
        policyContext: string,
        req?: IncomingMessage
    ): Promise<ChatResponse>;
    
    logAgentError(type: 'chat', error: Error, metadata?: Record<string, any>): void;
}

export interface DOADImplementation extends DOADHandler {}

// ----------
// PaceNote Types
// ----------
export interface PaceNoteRequest {
    input: string;
    rank: string;
}

export interface PaceNoteResponse {
    content: string;
    timestamp: string;
    rank: string;
}

// ----------
// Client UI Types
// ----------
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
