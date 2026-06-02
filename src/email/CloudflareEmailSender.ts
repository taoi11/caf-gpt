/**
 * src/email/CloudflareEmailSender.ts
 *
 * Sends reply emails using Cloudflare Email Service send_email binding
 *
 * Top-level declarations:
 * - CloudflareEmailSender: Sends structured normal replies and plain-text error responses
 * - buildThreadingHeaderMap: Builds Email Service custom headers for threading
 * - buildReplyAllCcRecipients: Builds safe reply-all CC recipients from the original email
 * - isAuthorizedReplyAllRecipient: Checks reply-all recipients against the configured allowlist
 */

import type { AuthorizationConfig } from "../config";
import { APIValidationError } from "../errors";
import { formatError, Logger } from "../Logger";
import type { ParsedEmailData, ThreadingHeaders } from "./types";
import { normalizeEmailAddress } from "./utils/EmailNormalizer";
import { isValidEmailAddress } from "./utils/EmailValidator";

const MAX_TOTAL_RECIPIENTS = 50;

/** Sends structured normal replies and plain-text error responses. */
export class CloudflareEmailSender {
  private readonly logger: Logger;
  private readonly selfAddresses: Set<string>;
  private readonly authorizedDomains: Set<string>;
  private readonly authorizedEmails: Set<string>;

  constructor(
    private readonly fromAddress: string,
    private readonly emailBinding?: SendEmail,
    selfAddresses: string[] = [],
    authorization: AuthorizationConfig = { authorizedDomains: [], authorizedEmails: [] }
  ) {
    this.logger = Logger.getInstance();
    this.selfAddresses = new Set(
      [fromAddress, ...selfAddresses]
        .map((address) => normalizeEmailAddress(address))
        .filter(Boolean)
    );
    this.authorizedDomains = new Set(
      authorization.authorizedDomains.map((domain) => domain.toLowerCase().trim()).filter(Boolean)
    );
    this.authorizedEmails = new Set(
      authorization.authorizedEmails
        .map((address) => normalizeEmailAddress(address))
        .filter(Boolean)
    );
  }

  async sendReply(
    originalEmail: ParsedEmailData,
    content: { text: string; html: string },
    threadingHeaders: ThreadingHeaders
  ): Promise<{ id: string }> {
    if (!this.emailBinding) {
      throw new APIValidationError("Cloudflare Email Service binding missing for reply");
    }

    const replyRecipient = normalizeEmailAddress(originalEmail.from);
    if (!replyRecipient || !isValidEmailAddress(replyRecipient)) {
      throw new APIValidationError(`Invalid reply recipient: ${originalEmail.from}`);
    }

    const ccRecipients = buildReplyAllCcRecipients(
      originalEmail,
      replyRecipient,
      this.selfAddresses,
      this.authorizedDomains,
      this.authorizedEmails
    );

    const subject = originalEmail.subject.startsWith("Re:")
      ? originalEmail.subject
      : `Re: ${originalEmail.subject}`;

    try {
      const response = await this.emailBinding.send({
        to: replyRecipient,
        ...(ccRecipients.length > 0 ? { cc: ccRecipients } : {}),
        from: { email: this.fromAddress, name: "CAF-GPT" },
        replyTo: this.fromAddress,
        subject,
        text: content.text,
        html: content.html,
        headers: buildThreadingHeaderMap(threadingHeaders),
      });

      return { id: response.messageId };
    } catch (error) {
      this.logger.error("Failed to send reply via Cloudflare Email Service", {
        to: replyRecipient,
        cc: ccRecipients,
        ...formatError(error),
      });
      throw new APIValidationError(
        `Cloudflare Email Service reply failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async sendErrorResponse(
    originalEmail: ParsedEmailData,
    errorMessage: string,
    threadingHeaders: ThreadingHeaders
  ): Promise<{ id: string }> {
    if (!this.emailBinding) {
      throw new APIValidationError("Cloudflare Email Service binding missing for error response");
    }

    const replyRecipient = normalizeEmailAddress(originalEmail.from);
    if (!replyRecipient || !isValidEmailAddress(replyRecipient)) {
      throw new APIValidationError(`Invalid error response recipient: ${originalEmail.from}`);
    }

    const subject = originalEmail.subject.startsWith("Re:")
      ? `Error Processing Email: ${originalEmail.subject.slice(3).trim()}`
      : "Error Processing Email";

    try {
      const response = await this.emailBinding.send({
        to: replyRecipient,
        from: { email: this.fromAddress, name: "CAF-GPT" },
        replyTo: this.fromAddress,
        subject,
        text: errorMessage,
        headers: buildThreadingHeaderMap(threadingHeaders),
      });

      return { id: response.messageId };
    } catch (error) {
      this.logger.error("Failed to send error response via Cloudflare Email Service", {
        to: replyRecipient,
        ...formatError(error),
      });
      throw new APIValidationError(
        `Cloudflare Email Service error reply failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}

/** Builds Email Service custom headers for threading. */
function buildThreadingHeaderMap(threadingHeaders: ThreadingHeaders): Record<string, string> {
  const headers: Record<string, string> = {};
  if (threadingHeaders.inReplyTo) {
    headers["In-Reply-To"] = threadingHeaders.inReplyTo;
  }
  if (threadingHeaders.references) {
    headers.References = threadingHeaders.references;
  }
  return headers;
}

/** Builds safe reply-all CC recipients from the original email. */
function buildReplyAllCcRecipients(
  originalEmail: ParsedEmailData,
  primaryRecipient: string,
  selfAddresses: Set<string>,
  authorizedDomains: Set<string>,
  authorizedEmails: Set<string>
): string[] {
  const ccRecipients: string[] = [];
  const seen = new Set([primaryRecipient, ...selfAddresses]);

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
