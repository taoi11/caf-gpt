/**
 * src/webhooks/types.ts
 *
 * Type definitions for Resend webhooks and API responses
 *
 * Top-level declarations:
 * - ResendWebhookEvent: Base webhook event structure
 * - ResendEmailReceivedEvent: email.received webhook event
 * - ResendEmailReceivedData: Email metadata in webhook
 * - ResendAttachmentMetadata: Attachment metadata in webhook
 * - ResendFullEmail: Full email from Resend API
 */

// Base webhook event structure
export interface ResendWebhookEvent {
  type: string;
  created_at: string;
  data: unknown;
}

// email.received webhook event
export interface ResendEmailReceivedEvent {
  type: "email.received";
  created_at: string;
  data: ResendEmailReceivedData;
}

// Email metadata in webhook (does NOT include body or full headers)
export interface ResendEmailReceivedData {
  email_id: string;
  created_at: string;
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  message_id: string;
  attachments: ResendAttachmentMetadata[];
}

// Attachment metadata (webhook does NOT include content)
export interface ResendAttachmentMetadata {
  id: string;
  filename: string;
  content_type: string;
  content_disposition: string;
  content_id?: string;
}

// Full email from Resend API (includes body and headers)
export interface ResendFullEmail {
  object: "email";
  id: string;
  to: string[];
  from: string;
  created_at: string;
  subject: string;
  html: string | null;
  text: string | null;
  headers: Record<string, string>;
  bcc: string[];
  cc: string[];
  reply_to: string[];
  message_id: string;
  attachments: ResendAttachmentMetadata[];
}
