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
 * - LoggableShortlistDiagnostics: Allowlisted shortlist diagnostic log fields (stage code, per-stage numbers)
 * - toLoggableShortlistDiagnostics: Keeps only allowlisted numeric/boolean shortlist diagnostics
 * - QuoteDiagnostics / LoggableQuoteDiagnostics: Quoted-history log fields (flags, counts, fixed reason)
 * - toLoggableQuoteDiagnostics: Keeps only allowlisted boolean/count/reason quoted-history fields
 * - getLogSafeDomain: Extracts a log-safe domain from an email address
 * - createEmailRef: Generates a random per-message correlation id
 * - getEmailRefFromHeaders: Reads the Worker-assigned emailRef, or generates a fresh one
 */

import { z } from "zod";
import type { ShortlistDiagnostics } from "../../agents/utils/ClefDecision";
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

/** Finite number, or dropped (strings, NaN, Infinity, and other types never reach the log). */
const LoggableNumberSchema = z.number().finite().optional().catch(undefined);

/** Allowlisted per-stage shortlist diagnostics; unknown keys are stripped. */
const ShortlistStageLogSchema = z
  .object({
    optionCount: LoggableNumberSchema,
    rankReached: LoggableNumberSchema,
    topIsNone: z.boolean().optional().catch(undefined),
    topConfidence: LoggableNumberSchema,
    topMargin: LoggableNumberSchema,
  })
  .optional()
  .catch(undefined);

/** Allowlisted shortlist diagnostics: the fixed stage code plus per-stage numbers and booleans. */
const ShortlistDiagnosticsLogSchema = z
  .object({
    shortlistStage: z.enum(["group", "document"]).optional().catch(undefined),
    group: ShortlistStageLogSchema,
    document: ShortlistStageLogSchema,
  })
  .catch({});

/** Shortlist diagnostic log fields: `shortlistStage` plus `shortlistGroup` / `shortlistDocument` numbers. */
export interface LoggableShortlistDiagnostics {
  shortlistStage?: "group" | "document";
  shortlistGroup?: z.infer<typeof ShortlistStageLogSchema>;
  shortlistDocument?: z.infer<typeof ShortlistStageLogSchema>;
}

/**
 * Returns shortlist diagnostics as log fields, keeping only the fixed stage code and allowlisted
 * numeric/boolean per-stage fields (stage 1 under shortlistGroup, stage 2 under shortlistDocument).
 * Anything else (strings, choice keys, titles, question text, unknown fields) is dropped, so a
 * caller bug cannot leak content into logs.
 * @param diagnostics - ShortlistDiagnostics from shortlistManifestFiles
 */
export function toLoggableShortlistDiagnostics(
  diagnostics: ShortlistDiagnostics | undefined
): LoggableShortlistDiagnostics {
  const parsed = ShortlistDiagnosticsLogSchema.parse(diagnostics ?? {});
  const fields: LoggableShortlistDiagnostics = {};

  if (parsed.shortlistStage !== undefined) fields.shortlistStage = parsed.shortlistStage;

  if (parsed.group !== undefined) fields.shortlistGroup = parsed.group;

  if (parsed.document !== undefined) fields.shortlistDocument = parsed.document;

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
