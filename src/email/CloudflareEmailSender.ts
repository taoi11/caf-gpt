/**
 * src/email/CloudflareEmailSender.ts
 *
 * Sends reply emails using Cloudflare Email Workers native reply API
 *
 * Top-level declarations:
 * - CloudflareEmailSender: Sends plain-text replies and error responses through message.reply()
 * - buildReplyMime: Builds RFC 822 plain-text MIME for normal replies
 * - buildErrorMime: Builds RFC 822 plain-text MIME for error responses
 */

import { EmailMessage } from "cloudflare:email";
import { APIValidationError } from "../errors";
import { formatError, Logger } from "../Logger";
import type { ParsedEmailData, ThreadingHeaders } from "./types";

/** Sends plain-text replies and error responses through message.reply(). */
export class CloudflareEmailSender {
  private readonly logger: Logger;

  constructor(private readonly fromAddress: string) {
    this.logger = Logger.getInstance();
  }

  async sendReply(
    originalEmail: ParsedEmailData,
    content: string,
    threadingHeaders: ThreadingHeaders
  ): Promise<{ id: string }> {
    if (!originalEmail.originalMessage) {
      throw new APIValidationError("Cloudflare EmailMessage context missing for reply");
    }

    const subject = originalEmail.subject.startsWith("Re:")
      ? originalEmail.subject
      : `Re: ${originalEmail.subject}`;

    const mime = buildReplyMime(
      this.fromAddress,
      originalEmail.from,
      subject,
      content,
      threadingHeaders
    );

    try {
      await originalEmail.originalMessage.reply(
        new EmailMessage(this.fromAddress, originalEmail.from, mime)
      );

      return { id: `cf-reply-${originalEmail.messageId ?? Date.now().toString()}` };
    } catch (error) {
      this.logger.error("Failed to send reply via Cloudflare Email Workers", {
        to: originalEmail.from,
        ...formatError(error),
      });
      throw new APIValidationError(
        `Cloudflare reply failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async sendErrorResponse(
    originalEmail: ParsedEmailData,
    errorMessage: string
  ): Promise<{ id: string }> {
    if (!originalEmail.originalMessage) {
      throw new APIValidationError("Cloudflare EmailMessage context missing for error response");
    }

    const mime = buildErrorMime(this.fromAddress, originalEmail.from, errorMessage);

    try {
      await originalEmail.originalMessage.reply(
        new EmailMessage(this.fromAddress, originalEmail.from, mime)
      );
      return { id: `cf-error-${originalEmail.messageId ?? Date.now().toString()}` };
    } catch (error) {
      this.logger.error("Failed to send error response via Cloudflare Email Workers", {
        to: originalEmail.from,
        ...formatError(error),
      });
      throw new APIValidationError(
        `Cloudflare error reply failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

/** Builds RFC 822 plain-text MIME for normal replies. */
function buildReplyMime(
  fromAddress: string,
  toAddress: string,
  subject: string,
  textBody: string,
  threadingHeaders: ThreadingHeaders
): string {
  const messageId = createMessageId(fromAddress);
  const headers = [
    `From: CAF-GPT <${fromAddress}>`,
    `To: <${toAddress}>`,
    `Subject: ${subject}`,
    `Message-ID: ${messageId}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
  ];

  if (threadingHeaders.inReplyTo) {
    headers.push(`In-Reply-To: ${threadingHeaders.inReplyTo}`);
  }

  if (threadingHeaders.references) {
    headers.push(`References: ${threadingHeaders.references}`);
  }

  return `${headers.join("\r\n")}\r\n\r\n${textBody}`;
}

/** Builds RFC 822 plain-text MIME for error responses. */
function buildErrorMime(fromAddress: string, toAddress: string, textBody: string): string {
  const messageId = createMessageId(fromAddress);
  return [
    `From: CAF-GPT <${fromAddress}>`,
    `To: <${toAddress}>`,
    "Subject: Error Processing Email",
    `Message-ID: ${messageId}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    textBody,
  ].join("\r\n");
}

// Builds a Message-ID value for outgoing emails.
function createMessageId(fromAddress: string): string {
  const domain = fromAddress.split("@")[1] || "caf-gpt.com";
  const unique = `${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 10)}`;
  return `<${unique}@${domain}>`;
}
