/**
 * src/email/utils/ReplyRecipients.ts
 *
 * Reply recipient utilities for safe reply-all behavior
 *
 * Top-level declarations:
 * - buildReplyAllCcRecipients: Builds safe reply-all CC recipients from the original email
 * - isAuthorizedReplyAllRecipient: Checks reply-all recipients against the configured allowlist
 */

import type { AuthorizationConfig } from "../../config";
import { APIValidationError } from "../../errors";
import type { ParsedEmailData } from "../types";
import { normalizeEmailAddress } from "./EmailNormalizer";
import { isValidEmailAddress } from "./EmailValidator";

const MAX_TOTAL_RECIPIENTS = 50;

/** Builds safe reply-all CC recipients from the original email. */
export function buildReplyAllCcRecipients(
  originalEmail: ParsedEmailData,
  primaryRecipient: string,
  selfAddresses: string[],
  authorization: AuthorizationConfig
): string[] {
  const ccRecipients: string[] = [];
  const seen = new Set(
    [primaryRecipient, ...selfAddresses]
      .map((address) => normalizeEmailAddress(address))
      .filter(Boolean)
  );
  const authorizedDomains = new Set(
    authorization.authorizedDomains.map((domain) => domain.toLowerCase().trim()).filter(Boolean)
  );
  const authorizedEmails = new Set(
    authorization.authorizedEmails.map((address) => normalizeEmailAddress(address)).filter(Boolean)
  );

  for (const ccAddress of originalEmail.cc) {
    const normalizedCc = normalizeEmailAddress(ccAddress);
    if (!normalizedCc || seen.has(normalizedCc)) {
      continue;
    }

    if (!isValidEmailAddress(normalizedCc)) {
      throw new APIValidationError(`Invalid reply-all CC recipient: ${ccAddress}`);
    }

    if (!isAuthorizedReplyAllRecipient(normalizedCc, authorizedDomains, authorizedEmails)) {
      continue;
    }

    ccRecipients.push(normalizedCc);
    seen.add(normalizedCc);
  }

  if (ccRecipients.length + 1 > MAX_TOTAL_RECIPIENTS) {
    throw new APIValidationError(
      `Reply-all recipient count exceeds Cloudflare Email Service limit of ${MAX_TOTAL_RECIPIENTS}`
    );
  }

  return ccRecipients;
}

/** Checks reply-all recipients against the configured allowlist. */
function isAuthorizedReplyAllRecipient(
  email: string,
  authorizedDomains: Set<string>,
  authorizedEmails: Set<string>
): boolean {
  if (authorizedEmails.has(email)) {
    return true;
  }

  return Array.from(authorizedDomains).some((domain) => email.endsWith(`@${domain}`));
}
