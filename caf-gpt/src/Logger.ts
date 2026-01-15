/**
 * src/utils/Logger.ts
 *
 * Singleton logger using native console for Cloudflare Workers
 * Cloudflare Workers automatically captures console logs with timestamps
 * Logs are emitted as single JSON objects for optimal Workers Logs queryability
 *
 * Top-level declarations:
 * - Logger: Singleton logger using native console - Workers handles timestamps and structured logging
 * - getInstance: Returns the singleton Logger instance
 * - formatError: Extracts message and stack from unknown error types
 */

interface LogContext {
  [key: string]: unknown;
}

// Simple logger using native console - Workers handles timestamps and structured logging
export class Logger {
  private static instance: Logger;

  private constructor() {
    // Private constructor to enforce singleton pattern
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  info(message: string, context?: LogContext): void {
    console.log({ message, level: "info", ...context });
  }

  warn(message: string, context?: LogContext): void {
    console.warn({ message, level: "warn", ...context });
  }

  error(message: string, context?: LogContext): void {
    console.error({ message, level: "error", ...context });
  }

  debug(message: string, context?: LogContext): void {
    console.debug({ message, level: "debug", ...context });
  }

  performance(operation: string, startTime: number, context?: LogContext): void {
    const processingTime = Date.now() - startTime;
    console.log({
      message: `Performance: ${operation} completed in ${processingTime}ms`,
      level: "info",
      ...context,
      processingTime,
      operation,
    });
  }
}

export function formatError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
    };
  }
  return {
    message: String(error),
  };
}
