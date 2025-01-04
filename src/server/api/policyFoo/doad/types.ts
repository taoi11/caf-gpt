import { Message, LLMInteractionData } from '../../../utils/types.js';
import { IncomingMessage } from 'http';

// Core DOAD Types
export interface PolicyReference {
    docId: string;          // DOAD number (e.g., "10001-1")
    section?: string;       // Policy section (e.g., "5.1")
}

export interface PolicyDocument {
    docId: string;
    content: string;
    lastModified: Date;
    policyGroup: string;
}

// Agent Communication Types
export interface ChatResponse {
    answer: string;         // Main response to user
    citations: string[];    // List of DOAD references used
    followUp?: string;      // Optional follow-up suggestions
}

// Logging Helpers
export interface DOADLogger {
    logAgentInteraction(type: 'finder' | 'chat', data: LLMInteractionData): void;
    logAgentError(type: 'finder' | 'chat', error: Error, metadata?: Record<string, any>): void;
}

// Base DOAD Handler Interface
export interface DOADHandler extends DOADLogger {
    getDOADPath(doadNumber: string): string;
    isValidDOADNumber(doadNumber: string): boolean;
    extractDOADNumbers(text: string): string[];
    validateRequest(message: string): boolean;
    formatResponse(response: ChatResponse): ChatResponse;
    getDOADContent(doadNumber: string): Promise<string>;
}

// Agent-Specific Interfaces
export interface DOADFinder extends DOADHandler {
    handleMessage(message: string, history?: Message[]): Promise<string[]>;
}

export interface DOADChat extends DOADHandler {
    handleMessage(
        message: string,
        userHistory: Message[],
        policyContext: string,
        req?: IncomingMessage
    ): Promise<ChatResponse>;
}

// Implementation Helpers
export interface DOADImplementation extends DOADHandler {} 