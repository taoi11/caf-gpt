import { IS_DEV } from './config.js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

// Log levels in order of verbosity
enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

class Logger {
    private readonly currentLevel: LogLevel;
    private readonly debugDir: string;
    private currentCallId: string | null = null;

    constructor() {
        this.currentLevel = IS_DEV ? LogLevel.DEBUG : LogLevel.INFO;
        this.debugDir = join(process.cwd(), 'data', 'debug');
        
        // Create debug directory if in dev mode
        if (IS_DEV) {
            mkdir(this.debugDir, { recursive: true })
                .catch(err => console.error('Failed to create debug directory:', err));
        }
    }

    private formatMessage(level: string, message: string): string {
        const timestamp = new Date().toISOString();
        return `[${timestamp.split('.')[0]}Z] ${level}: ${message}`;
    }

    private shouldLog(level: LogLevel): boolean {
        return level >= this.currentLevel;
    }

    // Add helper method to truncate long objects
    private truncateObject(obj: any, maxLength: number = 100): any {
        if (typeof obj !== 'object' || obj === null) {
            return obj;
        }
        
        const truncated: any = {};
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
                // Always truncate system messages
                if (key === 'content' && obj.role === 'system') {
                    truncated[key] = `${value.substring(0, maxLength)}...${value.substring(value.length - maxLength)}`;
                } else {
                    truncated[key] = value;
                }
            } else if (Array.isArray(value)) {
                truncated[key] = value.slice(0, 3);
                if (value.length > 3) {
                    truncated[key].push(`... ${value.length - 3} more`);
                }
            } else if (typeof value === 'object') {
                truncated[key] = this.truncateObject(value, maxLength);
            } else {
                truncated[key] = value;
            }
        }
        return truncated;
    }

    private formatRateLimit(info: any): string {
        if (!info?.current || !info?.calculated) return 'Invalid rate limit info';
        
        const { current, calculated } = info;
        return `h:${calculated.hourly.remaining}/${current.hourly.count} d:${calculated.daily.remaining}/${current.daily.count}`;
    }

    private formatResetTime(ms: number): string {
        const minutes = Math.floor(ms / 60000);
        return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes/60)}h`;
    }

    private formatRateLimitInfo(info: any): any {
        if (!info?.current || !info?.calculated) return info;
        
        return {
            limits: this.formatRateLimit(info),
            reset: {
                hourly: this.formatResetTime(info.calculated.hourly.resetIn),
                daily: this.formatResetTime(info.calculated.daily.resetIn)
            }
        };
    }

    // Add method to log full LLM messages
    private async logLLMCall(data: any, type: string): Promise<void> {
        if (!IS_DEV) return;

        try {
            // Generate call ID if this is a new user request
            if (type === 'USER_REQUEST') {
                this.currentCallId = new Date().toISOString().replace(/[:.]/g, '-');
            }

            if (!this.currentCallId) {
                this.currentCallId = new Date().toISOString().replace(/[:.]/g, '-');
            }

            const filename = `llm-call-${this.currentCallId}.log`;
            const filepath = join(this.debugDir, filename);
            
            // Truncate system messages before logging
            const truncatedData = this.truncateObject(data);
            
            const entry = `\n=== ${type} ${new Date().toISOString()} ===\n` +
                         JSON.stringify(truncatedData, null, 2) + '\n';

            // Ensure directory exists
            await mkdir(this.debugDir, { recursive: true });

            // Append to file
            await writeFile(
                filepath, 
                entry,
                { flag: 'a' }  // Append mode
            );

            // Reset call ID after chat response (end of chain)
            if (type === 'CHAT_RESPONSE') {
                this.currentCallId = null;
            }

        } catch (error) {
            console.error('Failed to log LLM call:', error);
        }
    }

    debug(message: string, ...args: any[]): void {
        if (this.shouldLog(LogLevel.DEBUG)) {
            // Check if this is an LLM-related message
            const isLLMMessage = 
                message.includes('LLM') || 
                message.includes('Request messages') || 
                message.includes('Finding relevant DOADs') ||
                message.includes('Chat agent');

            if (isLLMMessage) {
                // Log to file only
                if (message.includes('Finding relevant DOADs')) {
                    this.logLLMCall(args[0], 'USER_REQUEST');
                } else if (message.includes('Request messages')) {
                    const agentType = message.includes('Chat agent') ? 'CHAT_REQUEST' : 'FINDER_REQUEST';
                    this.logLLMCall(args[0], agentType);
                } else if (message.includes('LLM response received')) {
                    const agentType = message.includes('Chat agent') ? 'CHAT_RESPONSE' : 'FINDER_RESPONSE';
                    this.logLLMCall(args[0], agentType);
                }
                return; // Skip console logging for LLM messages
            }

            // Console logging for non-LLM messages
            const formattedArgs = args.map(arg => {
                if (message.includes('Rate limit info')) {
                    return this.formatRateLimitInfo(arg);
                }
                return typeof arg === 'object' ? this.truncateObject(arg) : arg;
            });
            console.debug(this.formatMessage('DEBUG', message), ...formattedArgs);
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
}

// Export singleton instance
export const logger = new Logger(); 