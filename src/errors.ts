/**
 * src/errors.ts
 *
 * Application error classes - consolidated error hierarchy
 *
 * Top-level declarations:
 * - BaseAppError: Base error class for all application errors
 * - EmailError: Base class for email-related errors
 * - EmailCompositionError: Email composition failures
 * - QuotedHistoryError: Outlook-style quoted history could not be built (fixed reason code)
 * - EmailParsingError: Email parsing failures
 * - EmailThreadingError: Email threading failures
 * - EmailValidationError: Email validation failures
 * - ResendOperation: Fixed names of the Resend API calls the mail path makes
 * - ResendAPIError: A Resend API call failed (operation and HTTP status only, never the body)
 * - AgentError: Base class for AI agent errors
 * - AgentTimeoutError: Agent/LLM timeout errors
 * - AgentAPIError: Agent/LLM API failures
 * - StorageError: Base class for storage errors
 * - StorageNotFoundError: Document/resource not found
 * - StorageConnectionError: Database/R2 connection failures
 */

import type { QuoteFailureReason } from "./email/components/QuotedHistory";

// Base error class for all application errors
export abstract class BaseAppError extends Error {
  abstract readonly code: string;
  abstract readonly recoverable: boolean;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ============================================
// Email Errors
// ============================================

// Base class for email-related errors
export abstract class EmailError extends BaseAppError {}

export class EmailCompositionError extends EmailError {
  readonly code = "EMAIL_COMPOSITION_ERROR";
  readonly recoverable = false;
}

/**
 * The reply's Outlook-style quoted history could not be built. Carries only a fixed,
 * content-free reason code (never email content), which UserAgent logs as the outcome reason;
 * as an EmailCompositionError it gets the funny composition error reply.
 */
export class QuotedHistoryError extends EmailCompositionError {
  readonly reason: QuoteFailureReason;

  constructor(reason: QuoteFailureReason) {
    super("Quoted history could not be built");
    this.reason = reason;
  }
}

export class EmailParsingError extends EmailError {
  readonly code = "EMAIL_PARSING_ERROR";
  readonly recoverable = true;
}

export class EmailThreadingError extends EmailError {
  readonly code = "EMAIL_THREADING_ERROR";
  readonly recoverable = true;
}

export class EmailValidationError extends EmailError {
  readonly code = "EMAIL_VALIDATION_ERROR";
  readonly recoverable = false;
}

/** Fixed names of the Resend API calls the mail path makes (safe to log). */
export type ResendOperation =
  | "get_inbox"
  | "get_received_email"
  | "download_raw"
  | "reply"
  | "get_sent_email";

/**
 * A Resend API call failed. Carries only the fixed operation name and the HTTP status (0 for a
 * network failure or a refused URL); the response body is never read into the error.
 */
export class ResendAPIError extends EmailError {
  readonly code = "RESEND_API_ERROR";
  readonly recoverable = true;
  readonly operation: ResendOperation;
  readonly status: number;

  constructor(operation: ResendOperation, status: number) {
    super("Resend API request failed");
    this.operation = operation;
    this.status = status;
  }
}

// ============================================
// Agent Errors (AI/LLM)
// ============================================

// Base class for AI agent errors
export abstract class AgentError extends BaseAppError {}

export class AgentTimeoutError extends AgentError {
  readonly code = "AGENT_TIMEOUT_ERROR";
  readonly recoverable = true;
}

export class AgentAPIError extends AgentError {
  readonly code = "AGENT_API_ERROR";
  readonly recoverable = true;
}

export class AgentValidationError extends AgentError {
  readonly code = "AGENT_VALIDATION_ERROR";
  readonly recoverable = false;
}

// ============================================
// Storage Errors (R2, Database)
// ============================================

// Base class for storage errors
export abstract class StorageError extends BaseAppError {}

export class StorageNotFoundError extends StorageError {
  readonly code = "STORAGE_NOT_FOUND";
  readonly recoverable = false;
}

export class StorageConnectionError extends StorageError {
  readonly code = "STORAGE_CONNECTION_ERROR";
  readonly recoverable = true;
}

export class StorageValidationError extends StorageError {
  readonly code = "STORAGE_VALIDATION_ERROR";
  readonly recoverable = false;
}
