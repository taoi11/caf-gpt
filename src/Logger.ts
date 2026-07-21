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
 * - getSafeErrorMetadata: Extracts only content-free error classification
 */

interface LogContext {
  [key: string]: unknown;
}

// Simple logger using native console - Workers handles timestamps and structured logging
// All output is JSON.stringify'd so CF Workers observability can parse and index fields
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

  private emit(method: "log" | "warn" | "error" | "debug", data: Record<string, unknown>): void {
    console[method](JSON.stringify(data));
  }

  info(message: string, context?: LogContext): void {
    this.emit("log", { message, level: "info", ...context });
  }

  warn(message: string, context?: LogContext): void {
    this.emit("warn", { message, level: "warn", ...context });
  }

  error(message: string, context?: LogContext): void {
    this.emit("error", { message, level: "error", ...context });
  }

  debug(message: string, context?: LogContext): void {
    this.emit("debug", { message, level: "debug", ...context });
  }

  performance(operation: string, startTime: number, context?: LogContext): void {
    const processingTime = Date.now() - startTime;
    this.emit("log", {
      message: `Performance: ${operation} completed in ${processingTime}ms`,
      level: "info",
      ...context,
      processingTime,
      operation,
    });
  }
}

/** Extracts safe error class/code metadata without exception text or stack content. */
export function getSafeErrorMetadata(error: unknown): Record<string, string | boolean> {
  if (error instanceof Error) {
    const candidate = error as Error & { code?: unknown; recoverable?: unknown };
    return {
      errorName: error.name,
      ...(typeof candidate.code === "string" ? { errorCode: candidate.code } : {}),
      ...(typeof candidate.recoverable === "boolean" ? { recoverable: candidate.recoverable } : {}),
    };
  }

  return { errorName: "UnknownError" };
}
