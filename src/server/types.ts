// Server Types - Consolidated Types for the Server Module
import { IncomingMessage, ServerResponse } from 'http';

// ----------
// Message Types (shared between client and server)
// ----------

// Message role
export type MessageRole = 'user' | 'assistant' | 'system';
// Message interface
export interface Message {
    role: MessageRole;
    content: string;
    timestamp: string;
}
// System message interface
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

// Policy handler interface
export interface PolicyHandler {
    handleMessage(
        message: string, 
        history?: Message[], 
        req?: IncomingMessage
    ): Promise<ChatResponse>;
}
// Policy router interface
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
        [key: string]: unknown;
    };
}
// LLM interaction data
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
        [key: string]: unknown;
    };
}
// DOAD logger interface
export interface DOADLogger {
    logAgentInteraction(type: 'finder' | 'chat', data: LLMInteractionData): void;
    logAgentError(type: 'finder' | 'chat', error: Error, metadata?: Record<string, unknown>): void;
}

// ----------
// LLM Core Types
// ----------

// LLM request interface
export interface LLMRequest {
    messages: Message[];
    systemPrompt?: string;      // Separate system prompt from conversation
    temperature?: number;
    model?: string;
    maxContextLength?: number;
}
// LLM response interface
export interface LLMResponse {
    content: string;
    model: string;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}
// LLM error interface
export interface LLMError {
    code: string;
    message: string;
    type: 'rate_limit' | 'invalid_request' | 'api_error' | 'connection_error';
}

// ----------
// Rate Limiting Types
// ----------

// Rate window interface
export interface RateWindow {
    timestamps: number[];  // Array of request timestamps in milliseconds
}
// Rate limit interface
export interface RateLimit {
    ip: string;
    hourly: RateWindow;
    daily: RateWindow;
    lastCleanup: number;  // Track last cleanup time
}
// Rate limit info interface
export interface RateLimitInfo {
    hourly: { remaining: number; resetIn: number };
    daily: { remaining: number; resetIn: number };
}
// Node rate limiter interface
export interface NodeRateLimiter {
    canMakeRequest(req: IncomingMessage): boolean | Promise<boolean>;
    trackSuccessfulRequest(req: IncomingMessage): void;
    getLimitInfo(req: IncomingMessage): RateLimitInfo;
    sendLimitResponse(req: IncomingMessage, res: ServerResponse, type: string): void;
}

// ----------
// Cost Tracking Types
// ----------

// Cost data interface
export interface CostData {
    apiCosts: number;        // Monthly LLM API costs in USD
    serverCosts: number;     // Monthly server costs in USD
    lastReset: string;       // YYYY-MM-DD of last monthly reset
    lastUpdated: string;     // Last update timestamp
}

// ----------
// Policy Types
// ----------

// Policy tool type
export type PolicyTool = 'doadFoo';
// Policy request interface
export interface PolicyRequest {
    tool: PolicyTool;
    message: string;
    conversationHistory?: Message[];
}
// Policy document interface
export interface PolicyDocument {
    docId: string;
    content: string;
    lastModified: Date;
    policyGroup: string;
}

// ----------
// DOAD Types
// ----------

// Policy reference interface
export interface PolicyReference {
    docId: string;          // DOAD number (e.g., "10001-1")
    section?: string;       // Policy section (e.g., "5.1")
}
// Chat response interface
export interface ChatResponse {
    answer: string;         // Main response to user
    citations: string[];    // List of DOAD references used
    followUp?: string;      // Optional follow-up suggestions
}
// DOAD handler interface
export interface DOADHandler {
    getDOADPath(doadNumber: string): string;
    isValidDOADNumber(doadNumber: string): boolean;
    extractDOADNumbers(text: string): string[];
    validateRequest(message: string): boolean;
    formatResponse(response: ChatResponse): ChatResponse;
    getDOADContent(doadNumber: string): Promise<string>;
}
// DOAD finder interface
export interface DOADFinder extends DOADHandler {
    handleMessage(message: string, history?: Message[]): Promise<string[]>;
    logAgentError(type: 'finder', error: Error, metadata?: Record<string, unknown>): void;
}
// DOAD chat interface
export interface DOADChat {
    handleMessage(
        message: string,
        userHistory: Message[],
        policyContext: string,
        req?: IncomingMessage
    ): Promise<ChatResponse>;
    
    logAgentError(type: 'chat', error: Error, metadata?: Record<string, unknown>): void;
}
// DOAD implementation interface
export interface DOADImplementation extends DOADHandler {
    initialize(): Promise<void>;
}
// DOAD prompts interface
export interface DOADPrompts {
    chatAgent: string;
    finderAgent: string;
}

// ----------
// PaceNote Types
// ----------

// Pace note request interface
export interface PaceNoteRequest {
    input: string;
    rank: string;
}
// Pace note response interface
export interface PaceNoteResponse {
    content: string;
    timestamp: string;
    rank: string;
}

// ----------
// Client UI Types
// ----------

// UI state interface
export interface UIState {
    inputText: string;          // Only this persists on refresh
    messages: Message[];        // Cleared on refresh
    isProcessing: boolean;
}
// UI elements interface
export interface UIElements {
    userInput: HTMLTextAreaElement;
    sendButton: HTMLButtonElement;
    chatHistory: HTMLDivElement;
    policySelector?: HTMLSelectElement;
    outputBox?: HTMLDivElement;
}