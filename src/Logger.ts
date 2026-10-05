/**
 * src/Logger.ts
 *
 * Singleton logger using native console for Cloudflare Workers
 * Cloudflare Workers automatically captures console logs with timestamps
 * Logs are emitted as plain objects so Workers Logs can index each field
 *
 * Top-level declarations:
 * - Logger: Singleton logger using native console - Workers handles timestamps and structured logging
 * - getInstance: Returns the singleton Logger instance
 * - getSafeErrorMetadata: Extracts only content-free error classification
 */

import { z } from "zod";

const ErrorMetadataDetailsSchema = z.object({
  code: z.string().optional().catch(undefined),
  recoverable: z.boolean().optional().catch(undefined),
});

export interface SafeErrorMetadata {
  errorName: string;
  errorCode?: string;
  recoverable?: boolean;
}

// Simple logger using native console - Workers handles timestamps and structured logging
// Pass a plain object. Workers indexes its fields; a JSON string is one opaque message.
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

  private emit<Data extends object>(method: "log" | "warn" | "error" | "debug", data: Data): void {
    console[method](data);
  }

  info<Context extends object>(message: string, context?: Context): void {
    this.emit("log", { message, level: "info", ...context });
  }

  warn<Context extends object>(message: string, context?: Context): void {
    this.emit("warn", { message, level: "warn", ...context });
  }

  error<Context extends object>(message: string, context?: Context): void {
    this.emit("error", { message, level: "error", ...context });
  }

  debug<Context extends object>(message: string, context?: Context): void {
    this.emit("debug", { message, level: "debug", ...context });
  }

  performance<Context extends object>(
    operation: string,
    startTime: number,
    context?: Context
  ): void {
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
export function getSafeErrorMetadata<ErrorValue>(error: ErrorValue): SafeErrorMetadata {
  if (!(error instanceof Error)) {
    return { errorName: "UnknownError" };
  }

  const details = ErrorMetadataDetailsSchema.parse(error);
  const metadata: SafeErrorMetadata = { errorName: error.name };
  if (details.code !== undefined) {
    metadata.errorCode = details.code;
  }
  if (details.recoverable !== undefined) {
    metadata.recoverable = details.recoverable;
  }
  return metadata;
}
