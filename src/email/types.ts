/**
 * src/email/types.ts
 *
 * Type definitions for email processing components
 *
 * Top-level declarations:
 * - ParsedEmailData: Parsed email data from Cloudflare Email Worker inbound event
 * - ThreadingHeaders: RFC 5322 threading headers
 */

export interface ParsedEmailData {
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  html?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
  date?: Date;
  originalMessage?: ForwardableEmailMessage;
}

export interface ThreadingHeaders {
  messageId?: string;
  inReplyTo?: string;
  references?: string;
}
