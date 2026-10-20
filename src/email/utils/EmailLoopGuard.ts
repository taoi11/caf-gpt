/**
 * src/email/utils/EmailLoopGuard.ts
 *
 * Auto-reply detection utilities for inbound email loop prevention
 *
 * Top-level declarations:
 * - AutoReplyCategory: Content-free category label for a matched auto-reply signal
 * - AutoReplyDetection: Detection result for auto-reply signals
 * - detectAutoReply: Detects common auto-reply and bounce indicators
 */

import type { ParsedEmailData } from "../types";

/** Content-free category label for a matched auto-reply signal (safe to log). */
export type AutoReplyCategory =
  | "auto_submitted"
  | "precedence"
  | "delivery_report"
  | "auto_reply_header"
  | "subject_pattern"
  | "sender_pattern";

/**
 * Detection result for auto-reply signals.
 * `reasons` may quote header values, the subject, or the sender and must never be logged;
 * `categories` and `matchedHeaders` (names from a fixed allowlist) are log-safe.
 */
export interface AutoReplyDetection {
  ignore: boolean;
  reasons: string[];
  categories: AutoReplyCategory[];
  matchedHeaders: string[];
}

const AUTO_REPLY_HEADERS = [
  "auto-submitted",
  "x-autoreply",
  "x-autorespond",
  "x-auto-reply",
  "x-auto-response",
  "x-autoresponse",
  "x-mail-autoreply",
  "x-auto-response-suppress",
];

const AUTO_REPLY_SUBJECT_PATTERNS = [
  /\bout of office\b/i,
  /\bautomatic reply\b/i,
  /\bauto[-\s]?reply\b/i,
  /\bauto[-\s]?response\b/i,
  /\baway from the office\b/i,
  /\bdelivery status notification\b/i,
  /\bmail delivery failed\b/i,
  /\bundeliverable\b/i,
  /\breturned mail\b/i,
  /\bfailure notice\b/i,
];

const AUTO_REPLY_SENDER_PATTERNS = [
  /^mailer-daemon\b/i,
  /^postmaster\b/i,
  /^no[-_.]?reply\b/i,
  /^do[-_.]?not[-_.]?reply\b/i,
  /^bounce\b/i,
];

// Detect common auto-reply/bounce signals to prevent mail loops
export function detectAutoReply(parsedEmail: ParsedEmailData): AutoReplyDetection {
  const headers = normalizeHeaders(parsedEmail.headers);
  const reasons: string[] = [];
  const lowConfidenceReasons: string[] = [];
  const categories: AutoReplyCategory[] = [];
  const lowConfidenceCategories: AutoReplyCategory[] = [];
  let matchedHeaders: string[] = [];

  const autoSubmitted = getHeaderValue(headers, "auto-submitted");
  const autoSubmittedToken = autoSubmitted?.split(";")[0]?.trim().toLowerCase();
  if (autoSubmittedToken && autoSubmittedToken !== "no") {
    reasons.push(`Auto-Submitted: ${autoSubmitted}`);
    categories.push("auto_submitted");
  }

  const precedence = getHeaderValue(headers, "precedence");
  const precedenceToken = precedence
    ?.split(/[,;\s]/)[0]
    ?.trim()
    .toLowerCase();
  if (precedenceToken && ["bulk", "junk", "list"].includes(precedenceToken)) {
    reasons.push(`Precedence: ${precedence}`);
    categories.push("precedence");
  }

  const contentType = getHeaderValue(headers, "content-type")?.toLowerCase() ?? "";
  if (contentType.includes("multipart/report") || contentType.includes("message/delivery-status")) {
    reasons.push(`Content-Type: ${contentType}`);
    categories.push("delivery_report");
  }

  if (hasAnyHeader(headers, AUTO_REPLY_HEADERS)) {
    matchedHeaders = AUTO_REPLY_HEADERS.filter((header) => header in headers);
    reasons.push(`Auto-reply headers: ${matchedHeaders.join(", ")}`);
    categories.push("auto_reply_header");
  }

  const subject = parsedEmail.subject ?? "";
  if (AUTO_REPLY_SUBJECT_PATTERNS.some((pattern) => pattern.test(subject))) {
    lowConfidenceReasons.push(`Subject: ${subject}`);
    lowConfidenceCategories.push("subject_pattern");
  }

  const senderLocalPart = parsedEmail.from?.split("@")[0] ?? "";
  if (AUTO_REPLY_SENDER_PATTERNS.some((pattern) => pattern.test(senderLocalPart))) {
    lowConfidenceReasons.push(`Sender: ${parsedEmail.from}`);
    lowConfidenceCategories.push("sender_pattern");
  }

  if (reasons.length === 0) {
    return { ignore: false, reasons: [], categories: [], matchedHeaders: [] };
  }

  return {
    ignore: true,
    reasons: [...reasons, ...lowConfidenceReasons],
    categories: [...categories, ...lowConfidenceCategories],
    matchedHeaders,
  };
}

// Read header value from normalized header map
function getHeaderValue(headers: Record<string, string>, name: string): string | undefined {
  return headers[name] ?? headers[name.toLowerCase()];
}

// Check if any auto-reply header is present
function hasAnyHeader(headers: Record<string, string>, headerNames: string[]): boolean {
  return headerNames.some((header) => header in headers);
}

// Normalize header keys to lowercase for consistent lookups
function normalizeHeaders(headers?: Record<string, string>) {
  const normalized: Record<string, string> = {};

  if (!headers) {
    return normalized;
  }

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    if (normalized[lowerKey]) {
      normalized[lowerKey] = `${normalized[lowerKey]}, ${value}`;
      continue;
    }
    normalized[lowerKey] = value;
  }

  return normalized;
}
