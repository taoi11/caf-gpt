// Node.js-Specific Types
import { IncomingMessage, ServerResponse } from 'http';
import type { Message, ChatResponse, LLMInteractionData, ApiResponse, PolicyTool } from './types.js';

// ----------
// HTTP-Related Types
// ----------

// Base policy handler interface
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

export interface DOADChat {
    handleMessage(
        message: string,
        userHistory: Message[],
        policyContext: string,
        req?: IncomingMessage
    ): Promise<ChatResponse>;
    
    // Error logging method
    logAgentError(type: 'chat', error: Error, metadata?: Record<string, any>): void;
}

// ----------
// Logger Types
// ----------
export interface DOADLogger {
    logAgentInteraction(type: 'finder' | 'chat', data: LLMInteractionData): void;
    logAgentError(type: 'finder' | 'chat', error: Error, metadata?: Record<string, any>): void;
}

// ----------
// Rate Limiter Types
// ----------
export interface NodeRateLimiter {
    canMakeRequest(req: IncomingMessage): boolean | Promise<boolean>;
    trackSuccessfulRequest(req: IncomingMessage): void;
    getLimitInfo(req: IncomingMessage): any;
    sendLimitResponse(req: IncomingMessage, res: ServerResponse, type: string): void;
} 