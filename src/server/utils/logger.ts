import { IS_DEV } from './config.js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { LLMInteractionData } from './types.js';

// Log levels in order of verbosity
enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

class Logger {
    private readonly currentLevel: LogLevel;
    private readonly logsDir: string;
    private currentCallId: string | null = null;
    private lastLoggedHash: string | null = null;

    constructor() {
        this.currentLevel = IS_DEV ? LogLevel.DEBUG : LogLevel.INFO;
        this.logsDir = join(process.cwd(), 'data', 'logs');
        
        // Create logs directory if in dev mode
        if (IS_DEV) {
            mkdir(this.logsDir, { recursive: true })
                .catch(err => console.error('Failed to create logs directory:', err));
        }
    }

    // Helper to trim system messages
    private trimSystemMessage(content: string): string {
        const maxLength = 200;
        if (content.length <= maxLength * 2) return content;
        return `${content.substring(0, maxLength)}...${content.substring(content.length - maxLength)}`;
    }

    // LLM logging method
    async logLLMInteraction(data: LLMInteractionData): Promise<void> {
        if (!IS_DEV) return;

        try {
            // Create a hash of the content to prevent duplicate logs
            const contentHash = JSON.stringify({
                role: data.role,
                content: data.content,
                metadata: data.metadata
            });
            
            if (contentHash === this.lastLoggedHash) {
                return; // Skip duplicate logs
            }
            this.lastLoggedHash = contentHash;

            // Only create new conversation ID if there isn't one and it's a user message
            if (!this.currentCallId && data.role === 'user') {
                this.currentCallId = new Date().toISOString().replace(/[:.]/g, '-');
            }

            // Ensure we have a call ID (fallback)
            if (!this.currentCallId) {
                this.currentCallId = new Date().toISOString().replace(/[:.]/g, '-');
            }

            const filename = `llm-${this.currentCallId}.log`;
            const filepath = join(this.logsDir, filename);

            // Ensure logs directory exists
            await mkdir(this.logsDir, { recursive: true });

            // Format the log entry
            const logEntry = {
                timestamp: new Date().toISOString(),
                content: {
                    ...data,
                    content: data.role === 'system' ? this.trimSystemMessage(data.content) : data.content
                }
            };

            const entry = JSON.stringify(logEntry, null, 2) + '\n';
            await writeFile(filepath, entry, { flag: 'a' });

            // Only reset conversation at the end of a chat response
            if (data.role === 'assistant' && data.content.includes('</citations>')) {
                this.currentCallId = null;
                this.lastLoggedHash = null;
            }
        } catch (error) {
            console.error('Failed to log LLM interaction:', error);
        }
    }

    debug(message: string, ...args: any[]): void {
        if (this.shouldLog(LogLevel.DEBUG)) {
            // Console logging for all debug messages
            console.debug(this.formatMessage('DEBUG', message), ...args);
        }
    }

    info(message: string, ...args: any[]): void {
        if (this.shouldLog(LogLevel.INFO)) {
            console.info(this.formatMessage('INFO', message), ...args);
        }
    }

    warn(message: string, ...args: any[]): void {
        if (this.shouldLog(LogLevel.WARN)) {
            console.warn(this.formatMessage('WARN', message), ...args);
        }
    }

    error(message: string | Error, ...args: any[]): void {
        if (this.shouldLog(LogLevel.ERROR)) {
            const errorMessage = message instanceof Error ? message.stack || message.message : message;
            console.error(this.formatMessage('ERROR', errorMessage), ...args);
        }
    }

    // Utility method for logging request information
    logRequest(method: string, url: string, statusCode: number): void {
        const level = statusCode >= 500 ? LogLevel.ERROR :
                     statusCode >= 400 ? LogLevel.WARN :
                     LogLevel.INFO;
        
        // Only log path portion of URL
        const path = url.split('?')[0];
        const message = `${method} ${path} - ${statusCode}`;
        
        switch (level) {
            case LogLevel.ERROR:
                this.error(message);
                break;
            case LogLevel.WARN:
                this.warn(message);
                break;
            default:
                // Only log non-200 responses at INFO level
                if (statusCode !== 200) {
                    this.info(message);
                } else {
                    this.debug(message);
                }
        }
    }

    private formatMessage(level: string, message: string): string {
        const timestamp = new Date().toISOString();
        return `[${timestamp.split('.')[0]}Z] ${level}: ${message}`;
    }

    private shouldLog(level: LogLevel): boolean {
        return level >= this.currentLevel;
    }
}

// Export singleton instance
export const logger = new Logger(); 