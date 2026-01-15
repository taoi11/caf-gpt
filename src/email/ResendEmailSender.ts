/**
 * src/email/ResendEmailSender.ts
 *
 * Send emails via Resend API with CC support
 *
 * Top-level declarations:
 * - ResendEmailSender: Email sender with full CC support (removes CF Email limitation)
 * - sendReply: Send reply with threading headers and CC recipients
 * - sendErrorResponse: Send error notification to original sender
 * - buildCCList: Extract CC recipients from original email
 */

import { Resend } from "resend";
import {
  APIAuthError,
  type APIError,
  APIRateLimitError,
  APITimeoutError,
  APIValidationError,
  isTypedAPIError,
} from "../errors";
import { formatError, Logger } from "../Logger";
import type { ParsedEmailData, ThreadingHeaders } from "./types";
import { normalizeEmailAddress } from "./utils/EmailNormalizer";

interface ErrorPattern {
  keywords: string[];
  create: (originalMessage: string) => APIError;
}

const RESEND_ERROR_PATTERNS: ErrorPattern[] = [
  {
    keywords: ["unauthorized", "api key", "authentication"],
    create: (msg) => new APIAuthError(`Resend authentication failed: ${msg}`),
  },
  {
    keywords: ["rate limit", "too many requests"],
    create: (msg) => new APIRateLimitError(`Resend rate limit exceeded: ${msg}`),
  },
  {
    keywords: ["timeout", "timed out"],
    create: (msg) => new APITimeoutError(`Resend request timed out: ${msg}`),
  },
  {
    keywords: ["invalid", "validation", "required", "format"],
    create: (msg) => new APIValidationError(`Resend validation failed: ${msg}`),
  },
];

const GENERIC_ERROR_PATTERNS: ErrorPattern[] = [
  {
    keywords: ["timeout", "timed out"],
    create: (msg) => new APITimeoutError(`Request timed out: ${msg}`),
  },
  {
    keywords: ["network", "connection"],
    create: (msg) => new APITimeoutError(`Network error: ${msg}`),
  },
];

function classifyByPatterns(
  patterns: ErrorPattern[],
  errorMessage: string,
  originalMessage: string,
  fallback: () => APIError
): APIError {
  const lowerMessage = errorMessage.toLowerCase();
  for (const pattern of patterns) {
    if (pattern.keywords.some((kw) => lowerMessage.includes(kw))) {
      return pattern.create(originalMessage);
    }
  }
  return fallback();
}

export class ResendEmailSender {
  private readonly resend: Resend;
  private readonly fromAddress: string;
  private readonly logger: Logger;

  constructor(apiKey: string, fromAddress: string) {
    this.resend = new Resend(apiKey);
    this.fromAddress = fromAddress;
    this.logger = Logger.getInstance();
  }

  async sendReply(
    originalEmail: ParsedEmailData,
    content: string,
    threadingHeaders: ThreadingHeaders,
    includeCC = true,
    htmlBody?: string
  ): Promise<{ id: string }> {
    try {
      const ccRecipients = includeCC ? this.buildCCList(originalEmail) : [];

      const subject = originalEmail.subject.startsWith("Re:")
        ? originalEmail.subject
        : `Re: ${originalEmail.subject}`;

      const { data, error } = await this.resend.emails.send(
        {
          from: this.fromAddress,
          to: [originalEmail.from],
          cc: ccRecipients.length > 0 ? ccRecipients : undefined,
          subject,
          text: content,
          html: htmlBody,
          headers: {
            ...(threadingHeaders.inReplyTo && {
              "In-Reply-To": threadingHeaders.inReplyTo,
            }),
            ...(threadingHeaders.references && {
              References: threadingHeaders.references,
            }),
          },
        },
        originalEmail.messageId ? { idempotencyKey: `reply-${originalEmail.messageId}` } : {}
      );

      if (error) {
        throw this.classifyResendError(error);
      }

      this.logger.info("Reply sent successfully via Resend", {
        emailId: data.id,
        to: originalEmail.from,
        ccCount: ccRecipients.length,
      });

      return { id: data.id };
    } catch (error) {
      if (isTypedAPIError(error)) throw error;

      this.logger.error("Failed to send reply via Resend", {
        ...formatError(error),
        to: originalEmail.from,
      });
      throw this.classifyGenericError(error);
    }
  }

  async sendErrorResponse(recipientEmail: string, errorMessage: string): Promise<{ id: string }> {
    try {
      const idempotencyKey = `error-${recipientEmail}-${Date.now()}`;
      const { data, error } = await this.resend.emails.send(
        {
          from: this.fromAddress,
          to: [recipientEmail],
          subject: "Error Processing Email",
          text: errorMessage,
        },
        { idempotencyKey }
      );

      if (error) {
        throw this.classifyResendError(error);
      }

      this.logger.info("Error response sent successfully via Resend", {
        emailId: data.id,
        to: recipientEmail,
      });

      return { id: data.id };
    } catch (error) {
      if (isTypedAPIError(error)) throw error;

      this.logger.error("Failed to send error response via Resend", {
        ...formatError(error),
        to: recipientEmail,
      });
      throw this.classifyGenericError(error);
    }
  }

  private buildCCList(originalEmail: ParsedEmailData): string[] {
    const excluded = new Set([
      normalizeEmailAddress(this.fromAddress),
      normalizeEmailAddress(originalEmail.from),
    ]);
    const seen = new Set<string>();

    const ccList = [...originalEmail.to, ...originalEmail.cc]
      .map((email) => normalizeEmailAddress(email))
      .filter((email) => {
        if (excluded.has(email) || seen.has(email)) return false;
        seen.add(email);
        return true;
      });

    if (ccList.length > 49) {
      this.logger.warn("CC list exceeds Resend limit, truncating", {
        originalCount: ccList.length,
        truncatedCount: 49,
      });
      return ccList.slice(0, 49);
    }

    return ccList;
  }

  private classifyResendError(error: { message: string; name?: string }): APIError {
    return classifyByPatterns(
      RESEND_ERROR_PATTERNS,
      error.message,
      error.message,
      () => new APIValidationError(`Resend API error: ${error.message}`)
    );
  }

  private classifyGenericError(error: unknown): APIError {
    const message = error instanceof Error ? error.message : String(error);
    return classifyByPatterns(
      GENERIC_ERROR_PATTERNS,
      message,
      message,
      () => new APIValidationError(`API request failed: ${message}`)
    );
  }
}
