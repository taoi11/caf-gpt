/**
 * Comprehensive logging system for application-wide event tracking and monitoring.
 * Provides structured logging with multiple severity levels, specialized LLM interaction
 * logging, and request tracking to aid in development and troubleshooting.
 */

import { IS_DEV } from './config';
import type { LLMInteractionData, Message, SystemMessage, LogEntry } from '../types';
import { randomUUID } from 'crypto';
// Log levels
export enum LogLevel {
    DEBUG = "DEBUG",
    INFO = "INFO",
    WARN = "WARN",
    ERROR = "ERROR"
}
// Log metadata
interface LogMetadata {
    [key: string]: unknown;
}
// Logger class for logging messages at different levels
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
        const messagesMetadata = data.metadata?.messages as (Message | SystemMessage)[] | undefined;
        const messages = messagesMetadata ? messagesMetadata.map((msg: Message | SystemMessage) => 
            msg.role === 'system' ? 
                { ...msg, content: this.trimSystemMessage(msg.content) } : 
                msg
        ) : [];
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
        const restMetadata = data.metadata ? { ...data.metadata } : {};
        if (restMetadata.messages) {
            delete restMetadata.messages;
        }
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
        const { ...restMetadata } = data.metadata || {};
        return JSON.stringify({
            ...response,
            ...restMetadata
        }, null, 2);
    }
    // Logs and tracks LLM API interactions with request/response correlation and timing data
    // Only active in development mode, silences in production.
    // Tracks the full request/response lifecycle including timing information for performance monitoring.
    async logLLMInteraction(data: LLMInteractionData): Promise<void> {
        if (!IS_DEV) return;
        let requestId = data.metadata?.requestId as string | undefined;
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
    // Logs debug messages
    debug(message: string, metadata?: LogMetadata): void {
        if (!this.shouldLog(LogLevel.DEBUG)) return;
        const entry = this.createLogEntry(LogLevel.DEBUG, message, metadata);
        console.debug(this.formatMessage(entry));
    }
    // Logs info messages
    info(message: string, metadata?: LogMetadata): void {
        if (!this.shouldLog(LogLevel.INFO)) return;
        const entry = this.createLogEntry(LogLevel.INFO, message, metadata);
        console.info(this.formatMessage(entry));
    }
    // Logs warning messages
    warn(message: string, metadata?: LogMetadata): void {
        if (!this.shouldLog(LogLevel.WARN)) return;
        const entry = this.createLogEntry(LogLevel.WARN, message, metadata);
        console.warn(this.formatMessage(entry));
    }
    // Logs error messages
    error(message: string, metadata?: LogMetadata): void {
        if (!this.shouldLog(LogLevel.ERROR)) return;
        const entry = this.createLogEntry(LogLevel.ERROR, message, metadata);
        console.error(this.formatMessage(entry));
    }
    // Logs HTTP request info with status-based levels
    logRequest(method: string, url: string, statusCode: number, metadata?: Record<string, unknown>): void {
        // Skip logging in production
        if (!IS_DEV) return;
        
        // Determine log level based on status code
        const level = statusCode >= 500 ? LogLevel.ERROR :
                     statusCode >= 400 ? LogLevel.WARN :
                     LogLevel.INFO;
        // Extract path without query parameters
        const path = url.split('?')[0];
        // Format log message
        const message = `${method} ${path} - ${statusCode}`;
        // Log with appropriate level
        switch (level) {
            case LogLevel.ERROR:
                // Log error for server errors (500+)
                this.error(message, metadata);
                break;
            case LogLevel.WARN:
                // Log warning for client errors (400-499)
                this.warn(message, metadata);
                break;
            default:
                // Log info for non-200 success codes, debug for 200
                if (statusCode !== 200) {
                    this.info(message, metadata);
                } else {
                    this.debug(message, metadata);
                }
        }
    }
    // Creates a structured log entry with standardized metadata
    private createLogEntry(level: LogLevel, message: string, metadata?: Record<string, unknown>): LogEntry {
        return {
            timestamp: new Date().toISOString(),
            level,
            message,
            metadata
        };
    }
    // Formats log messages
    private formatMessage(entry: LogEntry): string {
        const base = `[${entry.timestamp.split('.')[0]}Z] ${entry.level}: ${entry.message}`;
        return entry.metadata ? `${base} ${JSON.stringify(entry.metadata)}` : base;
    }
    // Checks if a log level should be logged
    private shouldLog(level: LogLevel): boolean {
        // Compare using the string values
        const levels = {
            [LogLevel.DEBUG]: 0,
            [LogLevel.INFO]: 1,
            [LogLevel.WARN]: 2,
            [LogLevel.ERROR]: 3
        };
        return levels[level] >= levels[this.currentLevel];
    }
}
// Export singleton instance
export const logger = new Logger(); 
