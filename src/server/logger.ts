import { IS_DEV } from './config';

// Log levels in order of verbosity
enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

class Logger {
    private readonly currentLevel: LogLevel;

    constructor() {
        this.currentLevel = IS_DEV ? LogLevel.DEBUG : LogLevel.INFO;
    }

    private formatMessage(level: string, message: string): string {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] ${level}: ${message}`;
    }

    private shouldLog(level: LogLevel): boolean {
        return level >= this.currentLevel;
    }

    debug(message: string, ...args: any[]): void {
        if (this.shouldLog(LogLevel.DEBUG)) {
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
        
        const message = `${method} ${url} - ${statusCode}`;
        
        switch (level) {
            case LogLevel.ERROR:
                this.error(message);
                break;
            case LogLevel.WARN:
                this.warn(message);
                break;
            default:
                this.info(message);
        }
    }
}

// Export singleton instance
export const logger = new Logger(); 