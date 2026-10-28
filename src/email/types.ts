/**
 * src/email/types.ts
 *
 * Type definitions for email processing components
 *
 * Top-level declarations:
 * - ParsedEmailData: Parsed email data from Cloudflare Email Worker inbound event
 * - ThreadingHeaders: RFC 5322 threading headers
 */

import type { QuoteHeaders } from "./components/QuotedHistory";

export interface ParsedEmailData {
  envelopeFrom: string;
  envelopeTo: string;
  from: string;
  replyTo: string[];
  replyToPresent: boolean;
  to: string[];
  cc: string[];
  subject: string;
  headers?: Record<string, string>;
  body: string;
  html?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
  date?: Date;
  /** Outlook-style display headers (names kept, real Date only) for the reply's quoted history. */
  quoteHeaders?: QuoteHeaders;
  originalMessage?: ForwardableEmailMessage;
}

export interface ThreadingHeaders {
  messageId?: string;
  inReplyTo?: string;
  references?: string;
}
