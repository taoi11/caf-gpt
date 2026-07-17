/**
 * src/email/utils/ReplyRecipients.ts
 *
 * Deterministic recipient selection for authorized successful email replies
 *
 * Top-level declarations:
 * - RecipientFilteringSummary: Counts excluded CC candidates without retaining addresses
 * - ResolvedReplyRecipients: Safe primary and CC recipients plus selection metadata
 * - resolveReplyRecipients: Selects an authorized primary recipient and filtered reply-all CCs
 * - isAuthorizedEmailAddress: Checks an address against exact email and domain allowlists
 */

import type { AppConfig, AuthorizationConfig } from "../../config";
import { EmailValidationError } from "../../errors";
import type { ParsedEmailData } from "../types";
import { normalizeEmailAddress } from "./EmailNormalizer";
import { isValidEmailAddress } from "./EmailValidator";

const CAF_GPT_SERVICE_DOMAIN = "caf-gpt.com";
const MAX_TOTAL_RECIPIENTS = 50;

export interface RecipientFilteringSummary {
  malformed: number;
  unauthorized: number;
  duplicate: number;
  primaryRecipient: number;
  envelopeSender: number;
  headerFrom: number;
  cafGpt: number;
  configuredSelf: number;
}

export interface ResolvedReplyRecipients {
  to: string;
  cc: string[];
  primarySource: "reply-to" | "from";
  filteringSummary: RecipientFilteringSummary;
}

/** Selects an authorized primary recipient and filtered reply-all CCs. */
export function resolveReplyRecipients(
  email: ParsedEmailData,
  config: AppConfig
): ResolvedReplyRecipients {
  const primarySource = email.replyToPresent ? "reply-to" : "from";
  const primaryCandidates = email.replyToPresent ? email.replyTo : [email.from];

  if (primaryCandidates.length !== 1) {
    throw new EmailValidationError("Successful reply requires exactly one primary mailbox");
  }

  const primaryRecipient = normalizeEmailAddress(primaryCandidates[0]);
  const envelopeSender = normalizeEmailAddress(email.envelopeFrom);
  const headerFrom = normalizeEmailAddress(email.from);
  if (headerFrom !== envelopeSender) {
    throw new EmailValidationError("RFC From must match the SMTP envelope sender");
  }
  if (primaryRecipient !== envelopeSender) {
    throw new EmailValidationError("Reply-To must match the SMTP envelope sender");
  }
  if (!isValidEmailAddress(primaryRecipient)) {
    throw new EmailValidationError("Successful reply primary mailbox is malformed");
  }
  if (isCafGptAddress(primaryRecipient) || isConfiguredSelfAddress(primaryRecipient, config)) {
    throw new EmailValidationError("Successful reply primary mailbox is a service address");
  }
  if (!isAuthorizedEmailAddress(primaryRecipient, config.authorization)) {
    throw new EmailValidationError("Successful reply primary mailbox is not authorized");
  }

  const summary = createFilteringSummary();
  const cc: string[] = [];
  const seen = new Set<string>();
  const configuredSelf = new Set(
    [config.email.agentFromEmail, ...config.email.monitoredAddresses]
      .map((address) => normalizeEmailAddress(address))
      .filter(Boolean)
  );

  for (const candidate of [...email.to, ...email.cc]) {
    const normalized = normalizeEmailAddress(candidate);

    if (!normalized || !isValidEmailAddress(normalized)) {
      summary.malformed++;
      continue;
    }
    if (isCafGptAddress(normalized)) {
      summary.cafGpt++;
      continue;
    }
    if (!isAuthorizedEmailAddress(normalized, config.authorization)) {
      summary.unauthorized++;
      continue;
    }
    if (normalized === primaryRecipient) {
      summary.primaryRecipient++;
      continue;
    }
    if (normalized === envelopeSender) {
      summary.envelopeSender++;
      continue;
    }
    if (normalized === headerFrom) {
      summary.headerFrom++;
      continue;
    }
    if (configuredSelf.has(normalized)) {
      summary.configuredSelf++;
      continue;
    }
    if (seen.has(normalized)) {
      summary.duplicate++;
      continue;
    }

    seen.add(normalized);
    cc.push(normalized);
  }

  if (cc.length + 1 > MAX_TOTAL_RECIPIENTS) {
    throw new EmailValidationError(
      `Successful reply exceeds the ${MAX_TOTAL_RECIPIENTS}-recipient service limit`
    );
  }

  return { to: primaryRecipient, cc, primarySource, filteringSummary: summary };
}

/** Checks an address against exact email and domain allowlists. */
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

/** Creates zeroed safe filtering counters. */
function createFilteringSummary(): RecipientFilteringSummary {
  return {
    malformed: 0,
    unauthorized: 0,
    duplicate: 0,
    primaryRecipient: 0,
    envelopeSender: 0,
    headerFrom: 0,
    cafGpt: 0,
    configuredSelf: 0,
  };
}

/** Checks whether an address belongs to the CAF-GPT service domain. */
function isCafGptAddress(email: string): boolean {
  const normalized = normalizeEmailAddress(email);
  const domain = normalized.slice(normalized.lastIndexOf("@") + 1);

  return domain === CAF_GPT_SERVICE_DOMAIN;
}

/** Checks whether an address is an exact configured sender or monitored alias. */
function isConfiguredSelfAddress(email: string, config: AppConfig): boolean {
  const normalized = normalizeEmailAddress(email);
  const configuredAddresses = new Set(
    [config.email.agentFromEmail, ...config.email.monitoredAddresses].map((address) =>
      normalizeEmailAddress(address)
    )
  );

  return configuredAddresses.has(normalized);
}
