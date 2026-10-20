/**
 * src/email/utils/LogRedaction.ts
 *
 * Privacy-preserving helpers for email-path log fields (no addresses, subjects, or bodies)
 *
 * Top-level declarations:
 * - EMAIL_REF_UNAVAILABLE: emailRef value used when the inbound message has no Message-ID
 * - EMAIL_REF_HASH_FAILED: emailRef value used when hashing is unavailable
 * - EMAIL_REF_HASH_PREFIX: Fixed domain-separation salt mixed into emailRef hashes
 * - toSafeLogToken: Restricts a free-form value to a short identifier-like token
 * - getLogSafeDomain: Extracts a log-safe domain from an email address
 * - createEmailRef: Builds a short non-reversible correlation id from the Message-ID header
 */

import { normalizeEmailAddress } from "./EmailNormalizer";

/** emailRef value used when the inbound message has no usable Message-ID. */
export const EMAIL_REF_UNAVAILABLE = "none";

/** emailRef value used when hashing fails, so logging never breaks the inbound boundary. */
export const EMAIL_REF_HASH_FAILED = "unavailable";

/** Fixed domain-separation salt so emailRef hashes are not plain Message-ID digests. */
export const EMAIL_REF_HASH_PREFIX = "caf-gpt:email-ref:v1:";

const SAFE_TOKEN_PATTERN = /^[A-Za-z0-9_.:-]{1,64}$/;
const SAFE_DOMAIN_PATTERN = /^[a-z0-9.-]{1,253}$/;
const EMAIL_REF_HEX_LENGTH = 16;

/**
 * Returns value when it is a short identifier-like token, otherwise fallback.
 * Rejects whitespace, `@`, and anything long enough to carry message content.
 * @param value - Candidate log value (error name, error code, enum-like reason)
 * @param fallback - Replacement for unsafe or missing values
 */
export function toSafeLogToken(value: string | undefined, fallback = "redacted"): string {
  if (value === undefined || !SAFE_TOKEN_PATTERN.test(value)) {
    return fallback;
  }
  return value;
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
 * Builds a short SHA-256-derived correlation id from the Message-ID so the Worker boundary log and
 * the UserAgent Durable Object logs for one email can be joined without logging the header itself.
 * Never throws.
 * @param messageId - Raw Message-ID header value
 */
export async function createEmailRef(messageId?: string | null): Promise<string> {
  const normalized = messageId?.trim() ?? "";
  if (normalized.length === 0) {
    return EMAIL_REF_UNAVAILABLE;
  }
  try {
    const bytes = new TextEncoder().encode(`${EMAIL_REF_HASH_PREFIX}${normalized}`);
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    let hex = "";
    for (const byte of digest) {
      hex += byte.toString(16).padStart(2, "0");
    }
    return hex.slice(0, EMAIL_REF_HEX_LENGTH);
  } catch {
    return EMAIL_REF_HASH_FAILED;
  }
}
