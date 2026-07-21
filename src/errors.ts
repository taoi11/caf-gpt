/**
 * src/errors.ts
 *
 * Application error classes - consolidated error hierarchy
 *
 * Top-level declarations:
 * - BaseAppError: Base error class for all application errors
 * - EmailError: Base class for email-related errors
 * - EmailCompositionError: Email composition failures
 * - EmailParsingError: Email parsing failures
 * - EmailThreadingError: Email threading failures
 * - EmailValidationError: Email validation failures
 * - AgentError: Base class for AI agent errors
 * - AgentTimeoutError: Agent/LLM timeout errors
 * - AgentAPIError: Agent/LLM API failures
 * - StorageError: Base class for storage errors
 * - StorageNotFoundError: Document/resource not found
 * - StorageConnectionError: Database/R2 connection failures
 * - APIError: Base class for external API errors
 * - APITimeoutError: External API timeout errors
 * - APIAuthError: External API authentication failures
 */

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

// ============================================
// API Errors (External services)
// ============================================

// Base class for external API errors
export abstract class APIError extends BaseAppError {}

export class APITimeoutError extends APIError {
  readonly code = "API_TIMEOUT_ERROR";
  readonly recoverable = true;
}

export class APIAuthError extends APIError {
  readonly code = "API_AUTH_ERROR";
  readonly recoverable = false;
}

export class APIRateLimitError extends APIError {
  readonly code = "API_RATE_LIMIT_ERROR";
  readonly recoverable = true;
}

export class APIValidationError extends APIError {
  readonly code = "API_VALIDATION_ERROR";
  readonly recoverable = false;
}

export type TypedAPIError = APIAuthError | APIRateLimitError | APITimeoutError | APIValidationError;

export function isTypedAPIError(error: unknown): error is TypedAPIError {
  return (
    error instanceof APIAuthError ||
    error instanceof APIRateLimitError ||
    error instanceof APITimeoutError ||
    error instanceof APIValidationError
  );
}
