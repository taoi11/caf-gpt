/**
 * src/email/utils/EmailLoopGuard.ts
 *
 * Auto-reply detection utilities for inbound email loop prevention
 *
 * Top-level declarations:
 * - AutoReplyDetection: Detection result for auto-reply signals
 * - detectAutoReply: Detects common auto-reply and bounce indicators
 */

import type { ParsedEmailData } from "../types";

export interface AutoReplyDetection {
  ignore: boolean;
  reasons: string[];
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

  const autoSubmitted = getHeaderValue(headers, "auto-submitted");
  const autoSubmittedToken = autoSubmitted?.split(";")[0]?.trim().toLowerCase();
  if (autoSubmittedToken && autoSubmittedToken !== "no") {
    reasons.push(`Auto-Submitted: ${autoSubmitted}`);
  }

  const precedence = getHeaderValue(headers, "precedence");
  const precedenceToken = precedence
    ?.split(/[,;\s]/)[0]
    ?.trim()
    .toLowerCase();
  if (precedenceToken && ["bulk", "junk", "list"].includes(precedenceToken)) {
    reasons.push(`Precedence: ${precedence}`);
  }

  const contentType = getHeaderValue(headers, "content-type")?.toLowerCase() ?? "";
  if (contentType.includes("multipart/report") || contentType.includes("message/delivery-status")) {
    reasons.push(`Content-Type: ${contentType}`);
  }

  if (hasAnyHeader(headers, AUTO_REPLY_HEADERS)) {
    const matched = AUTO_REPLY_HEADERS.filter((header) => header in headers).join(", ");
    reasons.push(`Auto-reply headers: ${matched}`);
  }

  const subject = parsedEmail.subject ?? "";
  if (AUTO_REPLY_SUBJECT_PATTERNS.some((pattern) => pattern.test(subject))) {
    lowConfidenceReasons.push(`Subject: ${subject}`);
  }

  const senderLocalPart = parsedEmail.from?.split("@")[0] ?? "";
  if (AUTO_REPLY_SENDER_PATTERNS.some((pattern) => pattern.test(senderLocalPart))) {
    lowConfidenceReasons.push(`Sender: ${parsedEmail.from}`);
  }

  if (reasons.length === 0) {
    return { ignore: false, reasons: [] };
  }

  return { ignore: true, reasons: [...reasons, ...lowConfidenceReasons] };
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
function normalizeHeaders(headers?: Record<string, string>): Record<string, string> {
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
