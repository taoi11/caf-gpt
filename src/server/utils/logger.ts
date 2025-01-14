import { IS_DEV } from './config.js';
import type { LLMInteractionData, Message, SystemMessage } from './types';
import { randomUUID } from 'crypto';

// Log levels in order of verbosity
enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    metadata?: {
        requestId?: string;
        [key: string]: any;
    };
}

interface LogMetadata {
    [key: string]: any;
}

class Logger {
    private readonly currentLevel: LogLevel;
    private llmRequests: Map<string, number> = new Map(); // Track request start times

    constructor() {
        this.currentLevel = IS_DEV ? LogLevel.DEBUG : LogLevel.INFO;
    }

    // Helper to trim system messages
    private trimSystemMessage(content: string): string {
        const maxLength = 200;
        if (content.length <= maxLength * 2) return content;
        return `${content.substring(0, maxLength)}...${content.substring(content.length - maxLength)}`;
    }

    // Format LLM request for logging
    private formatLLMRequest(data: LLMInteractionData, requestId: string): string {
        // Trim system messages in the messages array
        const messages = data.metadata?.messages?.map((msg: Message | SystemMessage) => 
            msg.role === 'system' ? 
                { ...msg, content: this.trimSystemMessage(msg.content) } : 
                msg
        );

        // Create request object with trimmed content
        const request = {
            requestId,
            timestamp: new Date().toISOString(),
            type: 'request',
            model: data.metadata?.model,
            temperature: data.metadata?.temperature,
            messages
        };

        // Add any additional metadata, excluding what we've already used
        const { model, temperature, messages: _, rawResponse, ...restMetadata } = data.metadata || {};
        
        return JSON.stringify({
            ...request,
            ...restMetadata
        }, null, 2);
    }

    // Format LLM response for logging
    private formatLLMResponse(data: LLMInteractionData, requestId: string, durationMs: number): string {
        const response = {
            requestId,
            timestamp: new Date().toISOString(),
            type: 'response',
            durationMs,
            content: data.content,
            model: data.metadata?.model,
            usage: data.metadata?.usage
        };

        // Add any additional metadata, excluding what we've already used
        const { model, usage, rawResponse, ...restMetadata } = data.metadata || {};
        
        return JSON.stringify({
            ...response,
            ...restMetadata
        }, null, 2);
    }

    // LLM logging method - console only, dev mode only
    async logLLMInteraction(data: LLMInteractionData): Promise<void> {
        if (!IS_DEV) return;

        let requestId = data.metadata?.requestId;
        const isRequest = data.metadata?.type === 'request';

        if (isRequest) {
            // Generate new request ID and store start time
            requestId = requestId || randomUUID();
            this.llmRequests.set(requestId, Date.now());
            console.debug(`\n[LLM Request] ${requestId}\n${this.formatLLMRequest(data, requestId)}`);
        } else {
            // Calculate duration for response
            const startTime = requestId ? this.llmRequests.get(requestId) : undefined;
            const durationMs = startTime ? Date.now() - startTime : 0;
            
            if (requestId) {
                this.llmRequests.delete(requestId); // Cleanup
            }
            
            console.debug(`\n[LLM Response] ${requestId || 'unknown'}\n${this.formatLLMResponse(data, requestId || 'unknown', durationMs)}`);
        }
    }

    debug(message: string, metadata?: LogMetadata): void {
        if (!this.shouldLog(LogLevel.DEBUG)) return;
        const entry = this.createLogEntry(LogLevel.DEBUG, message, metadata);
        console.debug(this.formatMessage(entry));
    }

    info(message: string, metadata?: LogMetadata): void {
        if (!this.shouldLog(LogLevel.INFO)) return;
        const entry = this.createLogEntry(LogLevel.INFO, message, metadata);
        console.info(this.formatMessage(entry));
    }

    warn(message: string, metadata?: LogMetadata): void {
        if (!this.shouldLog(LogLevel.WARN)) return;
        const entry = this.createLogEntry(LogLevel.WARN, message, metadata);
        console.warn(this.formatMessage(entry));
    }

    error(message: string, metadata?: LogMetadata): void {
        if (!this.shouldLog(LogLevel.ERROR)) return;
        const entry = this.createLogEntry(LogLevel.ERROR, message, metadata);
        console.error(this.formatMessage(entry));
    }

    // Utility method for logging request information
    logRequest(method: string, url: string, statusCode: number, metadata?: Record<string, any>): void {
        if (!IS_DEV) return;
        
        const level = statusCode >= 500 ? LogLevel.ERROR :
                     statusCode >= 400 ? LogLevel.WARN :
                     LogLevel.INFO;
        
        const path = url.split('?')[0];
        const message = `${method} ${path} - ${statusCode}`;
        
        switch (level) {
            case LogLevel.ERROR:
                this.error(message, metadata);
                break;
            case LogLevel.WARN:
                this.warn(message, metadata);
                break;
            default:
                if (statusCode !== 200) {
                    this.info(message, metadata);
                } else {
                    this.debug(message, metadata);
                }
        }
    }

    private createLogEntry(level: LogLevel, message: string, metadata?: Record<string, any>): LogEntry {
        return {
            timestamp: new Date().toISOString(),
            level,
            message,
            metadata
        };
    }

    private formatMessage(entry: LogEntry): string {
        const base = `[${entry.timestamp.split('.')[0]}Z] ${LogLevel[entry.level]}: ${entry.message}`;
        return entry.metadata ? `${base} ${JSON.stringify(entry.metadata)}` : base;
    }

    private shouldLog(level: LogLevel): boolean {
        return IS_DEV || level >= this.currentLevel;
    }
}

// Export singleton instance
export const logger = new Logger(); 