/**
 * src/email/utils/LogRedaction.ts
 *
 * Privacy-preserving helpers for email-path log fields (no addresses, subjects, or bodies)
 *
 * Top-level declarations:
 * - EMAIL_REF_HEADER: Internal header the Worker sets so UserAgent logs reuse the same emailRef
 * - OTHER_ERROR_NAME / OTHER_ERROR_CODE: Fixed classifications for error names/codes not allowlisted
 * - toLoggableErrorName: Maps an error name to an allowlisted value or OTHER_ERROR_NAME
 * - toLoggableErrorCode: Maps an error code to an allowlisted value or OTHER_ERROR_CODE
 * - getAiUpstreamCode: Extracts only the numeric Workers AI error code from a binding error
 * - TOOL_READ_REASONS / ToolReadReason: Fixed read_file research outcome codes
 * - ToolReadDiagnostics / LoggableToolReadDiagnostics: Read_file research log fields (counts, fixed reason)
 * - toLoggableToolReadDiagnostics: Keeps only allowlisted read_file counts and the fixed reason
 * - QuoteDiagnostics / LoggableQuoteDiagnostics: Quoted-history log fields (flags, counts, fixed reason)
 * - toLoggableQuoteDiagnostics: Keeps only allowlisted boolean/count/reason quoted-history fields
 * - SentZoneDiagnostics / LoggableSentZoneDiagnostics: Quoted Sent: zone log fields (source, offset, flag, reason)
 * - toLoggableSentZoneDiagnostics: Keeps only allowlisted Sent: zone fields
 * - getLogSafeDomain: Extracts a log-safe domain from an email address
 * - createEmailRef: Generates a random per-message correlation id
 * - getEmailRefFromHeaders: Reads the Worker-assigned emailRef, or generates a fresh one
 */

import { z } from "zod";
import type { SentZoneReason, SentZoneSource } from "../../agents/utils/SentTimeZone";
import type { QuoteFailureReason } from "../components/QuotedHistory";
import { normalizeEmailAddress } from "./EmailNormalizer";

/** Internal header the Worker sets before routing; the UserAgent logs reuse its value. */
export const EMAIL_REF_HEADER = "x-caf-gpt-email-ref";

/** Logged in place of any error name that is not on the allowlist. */
export const OTHER_ERROR_NAME = "OtherError";

/** Logged in place of any error code that is not on the allowlist. */
export const OTHER_ERROR_CODE = "other";

const SAFE_DOMAIN_PATTERN = /^[a-z0-9.-]{1,253}$/;
const EMAIL_REF_PATTERN = /^[0-9a-f]{16}$/;
const EMAIL_REF_HEX_LENGTH = 16;

/** Error names known to be fixed class names (JS built-ins, platform, app, and AI SDK errors). */
const LOGGABLE_ERROR_NAMES: ReadonlySet<string> = new Set([
  // JavaScript and Web Platform
  "Error",
  "AggregateError",
  "EvalError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "TypeError",
  "URIError",
  "AbortError",
  "TimeoutError",
  "NetworkError",
  "DataError",
  "OperationError",
  "NotSupportedError",
  "InvalidStateError",
  "DOMException",
  "ZodError",
  "UnknownError",
  // App errors (src/errors.ts)
  "EmailCompositionError",
  "QuotedHistoryError",
  "EmailParsingError",
  "EmailThreadingError",
  "EmailValidationError",
  "AgentTimeoutError",
  "AgentAPIError",
  "AgentValidationError",
  "StorageNotFoundError",
  "StorageConnectionError",
  "StorageValidationError",
  // Workers AI binding (workerd src/cloudflare/internal/ai-api.ts default names)
  "InferenceUpstreamError",
  "AiInternalError",
  // Vercel AI SDK (every AI_* name in the pinned ai / @ai-sdk/provider builds; drift-tested)
  "AI_APICallError",
  "AI_DownloadError",
  "AI_EmptyResponseBodyError",
  "AI_InvalidArgumentError",
  "AI_InvalidDataContentError",
  "AI_InvalidMessageRoleError",
  "AI_InvalidPromptError",
  "AI_InvalidResponseDataError",
  "AI_InvalidStreamPartError",
  "AI_InvalidToolApprovalError",
  "AI_InvalidToolInputError",
  "AI_JSONParseError",
  "AI_LoadAPIKeyError",
  "AI_LoadSettingError",
  "AI_MessageConversionError",
  "AI_MissingToolResultsError",
  "AI_NoContentGeneratedError",
  "AI_NoImageGeneratedError",
  "AI_NoObjectGeneratedError",
  "AI_NoOutputGeneratedError",
  "AI_NoSpeechGeneratedError",
  "AI_NoSuchModelError",
  "AI_NoSuchProviderError",
  "AI_NoSuchToolError",
  "AI_NoTranscriptGeneratedError",
  "AI_NoVideoGeneratedError",
  "AI_RetryError",
  "AI_TooManyEmbeddingValuesForCallError",
  "AI_ToolCallNotFoundForApprovalError",
  "AI_ToolCallRepairError",
  "AI_TypeValidationError",
  "AI_UIMessageStreamError",
  "AI_UnsupportedFunctionalityError",
  "AI_UnsupportedModelVersionError",
]);

/** Error codes known to be fixed values (app error codes from src/errors.ts). */
const LOGGABLE_ERROR_CODES: ReadonlySet<string> = new Set([
  "EMAIL_COMPOSITION_ERROR",
  "EMAIL_PARSING_ERROR",
  "EMAIL_THREADING_ERROR",
  "EMAIL_VALIDATION_ERROR",
  "AGENT_TIMEOUT_ERROR",
  "AGENT_API_ERROR",
  "AGENT_VALIDATION_ERROR",
  "STORAGE_NOT_FOUND",
  "STORAGE_CONNECTION_ERROR",
  "STORAGE_VALIDATION_ERROR",
]);

/** Workers AI binding error names whose message starts with a numeric `<code>: ` prefix. */
const AI_BINDING_ERROR_NAMES: ReadonlySet<string> = new Set([
  "InferenceUpstreamError",
  "AiInternalError",
]);

/** Leading numeric code of a Workers AI binding error message (digits only, nothing after the colon). */
const AI_UPSTREAM_CODE_PATTERN = /^(\d{1,6}):/;

/**
 * Returns the numeric Workers AI error code (for example 5006) from a binding error, or undefined.
 * Only the leading digits are returned; the message text itself is never returned or logged.
 * @param error - Value caught from env.AI.run
 */
export function getAiUpstreamCode<ErrorValue>(error: ErrorValue): number | undefined {
  if (!(error instanceof Error) || !AI_BINDING_ERROR_NAMES.has(error.name)) return undefined;
  const match = AI_UPSTREAM_CODE_PATTERN.exec(error.message);

  return match ? Number(match[1]) : undefined;
}

/** Fixed, content-free outcome codes of a DOAD/QR&O read_file research run; safe to log. */
export const TOOL_READ_REASONS = [
  "read_ok",
  "empty_question",
  "index_no_rows",
  "bad_call_budget_exhausted",
  "call_limit_exceeded",
  "tool_failed",
  "tool_input_invalid",
  "step_limit_reached",
  "no_successful_reads",
  "empty_answer",
] as const;

/** One fixed read_file research outcome code. */
export type ToolReadReason = (typeof TOOL_READ_REASONS)[number];

/** Read_file research facts a caller may offer for logging (counts and a fixed reason only). */
export interface ToolReadDiagnostics {
  readReason?: ToolReadReason;
  totalCalls?: number;
  successfulReads?: number;
  badCalls?: number;
  steps?: number;
  indexRows?: number;
  skippedRows?: number;
}

/** Non-negative integer count, or dropped (strings, NaN, negatives, and other types never pass). */
const LoggableCountSchema = z.number().int().nonnegative().optional().catch(undefined);

/** Allowlisted read_file research log fields; unknown keys (ids, titles, text) are stripped. */
const ToolReadDiagnosticsLogSchema = z
  .object({
    readReason: z.enum(TOOL_READ_REASONS).optional().catch(undefined),
    totalCalls: LoggableCountSchema,
    successfulReads: LoggableCountSchema,
    badCalls: LoggableCountSchema,
    steps: LoggableCountSchema,
    indexRows: LoggableCountSchema,
    skippedRows: LoggableCountSchema,
  })
  .catch({});

/** Read_file research log fields after the allowlist. */
export type LoggableToolReadDiagnostics = z.infer<typeof ToolReadDiagnosticsLogSchema>;

/**
 * Returns read_file research diagnostics as log fields: the fixed outcome code plus call, read,
 * bad-call, step, index-row, and skipped-row counts. Anything else (the question, document ids,
 * titles, bodies, prompts, model output, unknown fields) is dropped, so a caller bug cannot leak
 * content into logs.
 * @param diagnostics - Counts and reason from ToolReadingAgent
 */
export function toLoggableToolReadDiagnostics(
  diagnostics: ToolReadDiagnostics
): LoggableToolReadDiagnostics {
  const parsed = ToolReadDiagnosticsLogSchema.parse(diagnostics);
  const fields: LoggableToolReadDiagnostics = {};

  if (parsed.readReason !== undefined) fields.readReason = parsed.readReason;

  if (parsed.totalCalls !== undefined) fields.totalCalls = parsed.totalCalls;

  if (parsed.successfulReads !== undefined) fields.successfulReads = parsed.successfulReads;

  if (parsed.badCalls !== undefined) fields.badCalls = parsed.badCalls;

  if (parsed.steps !== undefined) fields.steps = parsed.steps;

  if (parsed.indexRows !== undefined) fields.indexRows = parsed.indexRows;

  if (parsed.skippedRows !== undefined) fields.skippedRows = parsed.skippedRows;

  return fields;
}

/** Quoted-history facts a caller may offer for logging (flags, counts, and a fixed reason). */
export interface QuoteDiagnostics {
  quotedHistoryIncluded: boolean;
  quotedHtml?: boolean;
  quoteSourceBytes?: number;
  quoteRemovedNodes?: number;
  quoteFailureReason?: QuoteFailureReason;
}

/** Allowlisted quoted-history log fields; strings other than the fixed reasons never pass. */
const QuoteDiagnosticsLogSchema = z.object({
  quotedHistoryIncluded: z.boolean().catch(false),
  quotedHtml: z.boolean().optional().catch(undefined),
  quoteSourceBytes: z.number().int().nonnegative().optional().catch(undefined),
  quoteRemovedNodes: z.number().int().nonnegative().optional().catch(undefined),
  quoteFailureReason: z
    .enum([
      "quote_missing_headers",
      "quote_missing_sender",
      "quote_missing_date",
      "quote_sanitize_failed",
    ])
    .optional()
    .catch(undefined),
});

/** Quoted-history log fields after the allowlist (unknown keys stripped). */
export type LoggableQuoteDiagnostics = z.infer<typeof QuoteDiagnosticsLogSchema>;

/**
 * Returns quoted-history diagnostics as log fields: whether the quote was included, whether it
 * embedded HTML, the source byte count, the sanitizer drop count, and the fixed failure reason.
 * Anything else (names, addresses, subjects, bodies, header values) is dropped.
 * @param diagnostics - Quoted-history facts from UserAgent.sendReply
 */
export function toLoggableQuoteDiagnostics(
  diagnostics: QuoteDiagnostics
): LoggableQuoteDiagnostics {
  const parsed = QuoteDiagnosticsLogSchema.parse(diagnostics);
  const fields: LoggableQuoteDiagnostics = { quotedHistoryIncluded: parsed.quotedHistoryIncluded };

  if (parsed.quotedHtml !== undefined) fields.quotedHtml = parsed.quotedHtml;

  if (parsed.quoteSourceBytes !== undefined) fields.quoteSourceBytes = parsed.quoteSourceBytes;

  if (parsed.quoteRemovedNodes !== undefined) fields.quoteRemovedNodes = parsed.quoteRemovedNodes;

  if (parsed.quoteFailureReason !== undefined) {
    fields.quoteFailureReason = parsed.quoteFailureReason;
  }

  return fields;
}

/** Quoted Sent: zone facts a caller may offer for logging (no quoted text, times, or IDs). */
export interface SentZoneDiagnostics {
  source: SentZoneSource;
  offsetMinutes?: number;
  lineFound: boolean;
  reason?: SentZoneReason;
}

/** Allowlisted Sent: zone log fields; strings other than the fixed enums never pass. */
const SentZoneDiagnosticsLogSchema = z.object({
  source: z.enum(["learned", "saved", "default"]).catch("default"),
  offsetMinutes: z.number().int().min(-720).max(840).optional().catch(undefined),
  lineFound: z.boolean().catch(false),
  reason: z
    .enum([
      "quoted_sent_unparseable",
      "quoted_sent_no_record",
      "quoted_sent_unmatched",
      "quoted_sent_ambiguous",
      "quoted_sent_storage_failed",
    ])
    .optional()
    .catch(undefined),
});

/** Sent: zone log fields after the allowlist. */
export interface LoggableSentZoneDiagnostics {
  quoteSentZoneSource: SentZoneSource;
  quoteSentLineFound: boolean;
  quoteSentOffsetMinutes?: number;
  quoteSentReason?: SentZoneReason;
}

/**
 * Returns the quoted Sent: zone as log fields: where the zone came from, the offset used (minutes
 * east of UTC), whether CAF-GPT's own quoted Sent: line was found, and the fixed failure reason.
 * The quoted text, its times, addresses, and Message-IDs are never logged.
 * @param diagnostics - SentZoneDecision from resolveSentZone
 */
export function toLoggableSentZoneDiagnostics(
  diagnostics: SentZoneDiagnostics
): LoggableSentZoneDiagnostics {
  const parsed = SentZoneDiagnosticsLogSchema.parse(diagnostics);

  const fields: LoggableSentZoneDiagnostics = {
    quoteSentZoneSource: parsed.source,
    quoteSentLineFound: parsed.lineFound,
  };

  if (parsed.offsetMinutes !== undefined) fields.quoteSentOffsetMinutes = parsed.offsetMinutes;

  if (parsed.reason !== undefined) fields.quoteSentReason = parsed.reason;

  return fields;
}

/**
 * Returns the error name when it is allowlisted, otherwise OTHER_ERROR_NAME.
 * Unknown names are never logged raw, since a dependency could place user content in them.
 * @param name - Error.name value
 */
export function toLoggableErrorName(name: string | undefined): string {
  return name !== undefined && LOGGABLE_ERROR_NAMES.has(name) ? name : OTHER_ERROR_NAME;
}

/**
 * Returns the error code when it is allowlisted, otherwise OTHER_ERROR_CODE.
 * @param code - Error code value
 */
export function toLoggableErrorCode(code: string): string {
  return LOGGABLE_ERROR_CODES.has(code) ? code : OTHER_ERROR_CODE;
}

/**
 * Extracts the lowercase domain of an email address for logs; never returns the local part.
 * @param address - Raw or normalized email address (display-name forms accepted)
 */
export function getLogSafeDomain(address?: string | null): string {
  const normalized = normalizeEmailAddress(address);
  const at = normalized.lastIndexOf("@");

  if (at < 0) {
    return "";
  }

  const domain = normalized.slice(at + 1);

  return SAFE_DOMAIN_PATTERN.test(domain) ? domain : "invalid";
}

/**
 * Generates a random 16-hex-character correlation id for one inbound message.
 * Derived from no message content, so it is unique even when Message-ID is missing.
 */
export function createEmailRef(): string {
  return crypto.randomUUID().replaceAll("-", "").slice(0, EMAIL_REF_HEX_LENGTH);
}

/**
 * Returns the Worker-assigned emailRef from the internal header when well-formed,
 * otherwise a freshly generated one (never a shared constant).
 * @param headers - Inbound message headers as routed by the Worker
 */
export function getEmailRefFromHeaders(headers: Headers): string {
  const value = headers.get(EMAIL_REF_HEADER)?.trim().toLowerCase() ?? "";

  return EMAIL_REF_PATTERN.test(value) ? value : createEmailRef();
}
