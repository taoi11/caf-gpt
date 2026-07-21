/**
 * src/email/utils/ReplyRecipients.ts
 *
 * Outlook-style recipient selection for successful email replies
 *
 * Top-level declarations:
 * - ResolvedReplyRecipients: Ordered primary and carbon-copy recipients
 * - resolveReplyRecipients: Selects and filters reply-all recipients
 * - isAuthorizedEmailAddress: Checks an address against the inbound authorization policy
 */

import type { AppConfig, AuthorizationConfig } from "../../config";
import { EmailValidationError } from "../../errors";
import type { ParsedEmailData } from "../types";
import { normalizeEmailAddress } from "./EmailNormalizer";
import { isValidEmailAddress } from "./EmailValidator";

const CAF_GPT_SERVICE_DOMAIN = "caf-gpt.com";
const MAX_TOTAL_RECIPIENTS = 50;

export interface ResolvedReplyRecipients {
  to: string[];
  cc: string[];
}

/** Selects valid Reply-To mailboxes, or From, and preserves Outlook-style reply-all order. */
export function resolveReplyRecipients(
  email: ParsedEmailData,
  config: AppConfig
): ResolvedReplyRecipients {
  const selfAddresses = new Set(
    [config.email.agentFromEmail, ...config.email.monitoredAddresses]
      .map((address) => normalizeEmailAddress(address))
      .filter(Boolean)
  );
  const to = collectPrimaryRecipients(email, selfAddresses);
  const excluded = new Set([
    ...to,
    normalizeEmailAddress(email.envelopeFrom),
    normalizeEmailAddress(email.from),
  ]);
  const seen = new Set<string>();
  const cc: string[] = [];

  for (const candidate of [...email.to, ...email.cc]) {
    const normalized = normalizeEmailAddress(candidate);
    if (
      !normalized ||
      !isValidEmailAddress(normalized) ||
      isServiceAddress(normalized, selfAddresses) ||
      excluded.has(normalized) ||
      seen.has(normalized)
    ) {
      continue;
    }

    seen.add(normalized);
    cc.push(normalized);
  }

  if (to.length + cc.length > MAX_TOTAL_RECIPIENTS) {
    throw new EmailValidationError(
      `Successful reply exceeds the ${MAX_TOTAL_RECIPIENTS}-recipient service limit`
    );
  }

  return { to, cc };
}

/** Checks an address against exact email and domain inbound authorization rules. */
export function isAuthorizedEmailAddress(
  email: string,
  authorization: AuthorizationConfig
): boolean {
  const normalized = normalizeEmailAddress(email);
  if (!isValidEmailAddress(normalized)) {
    return false;
  }

  const authorizedEmails = new Set(
    authorization.authorizedEmails.map((address) => normalizeEmailAddress(address)).filter(Boolean)
  );
  if (authorizedEmails.has(normalized)) {
    return true;
  }

  const domain = normalized.slice(normalized.lastIndexOf("@") + 1);
  return authorization.authorizedDomains.some(
    (authorizedDomain) => domain === authorizedDomain.toLowerCase().trim()
  );
}

/** Collects unique valid Reply-To recipients and falls back to the RFC From mailbox. */
function collectPrimaryRecipients(email: ParsedEmailData, selfAddresses: Set<string>): string[] {
  const replyTo = collectUniqueValidAddresses(email.replyTo, selfAddresses);
  if (replyTo.length > 0) {
    return replyTo;
  }

  const from = collectUniqueValidAddresses([email.from], selfAddresses);
  if (from.length === 0) {
    throw new EmailValidationError("Successful reply requires a valid non-service mailbox");
  }

  return from;
}

/** Normalizes and filters a mailbox list while preserving first occurrence order. */
function collectUniqueValidAddresses(candidates: string[], selfAddresses: Set<string>): string[] {
  const addresses: string[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const normalized = normalizeEmailAddress(candidate);
    if (
      !normalized ||
      !isValidEmailAddress(normalized) ||
      isServiceAddress(normalized, selfAddresses) ||
      seen.has(normalized)
    ) {
      continue;
    }

    seen.add(normalized);
    addresses.push(normalized);
  }

  return addresses;
}

/** Checks whether an address is a configured identity or belongs to CAF-GPT's service domain. */
function isServiceAddress(email: string, selfAddresses: Set<string>): boolean {
  const domain = email.slice(email.lastIndexOf("@") + 1);
  return domain === CAF_GPT_SERVICE_DOMAIN || selfAddresses.has(email);
}
