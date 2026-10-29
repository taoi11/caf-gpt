/**
 * src/email/resend/ResendWebhook.ts
 *
 * Verifies and parses Resend webhook requests. Resend signs webhooks with Svix, which follows the
 * Standard Webhooks spec: the signed content is `${id}.${timestamp}.${rawBody}`, signed with
 * HMAC-SHA256 under the base64 key after the `whsec_` prefix, and the signature header is a
 * space-separated list of `v1,<base64>` entries. Verification uses Web Crypto's HMAC verify, which
 * compares in constant time, and rejects timestamps more than five minutes from now (the
 * standardwebhooks library default). Only fixed reason codes come out of here, never header
 * values or body content.
 * Docs: https://resend.com/docs/webhooks/verify-webhooks-requests
 * and https://resend.com/docs/webhooks/inboxes/email-received
 *
 * Top-level declarations:
 * - RESEND_WEBHOOK_TOLERANCE_SECONDS: Allowed clock skew between the signature timestamp and now
 * - RESEND_WEBHOOK_MAX_BODY_BYTES: Largest webhook body accepted (the payload carries no email body)
 * - WebhookRejectReason: Fixed, content-free reasons a webhook request was rejected
 * - WebhookVerification: Result of signature verification
 * - InboxEmailReceivedEvent: The fields CAF-GPT uses from an inbox.email.received event
 * - ParsedWebhookEvent: Parsed webhook event (received email, or another type to ignore)
 * - verifyResendWebhook: Verifies the Svix / Standard Webhooks signature and timestamp
 * - parseResendWebhookEvent: Parses a verified webhook body into the fields CAF-GPT uses
 */

import { z } from "zod";

/** Allowed skew, in seconds, between the signature timestamp and now (either direction). */
export const RESEND_WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

/** Largest webhook body accepted; inbox events carry metadata only, never the email body. */
export const RESEND_WEBHOOK_MAX_BODY_BYTES = 256 * 1024;

/** Fixed, content-free reasons a webhook request was rejected (safe to log). */
export type WebhookRejectReason =
  | "webhook_missing_headers"
  | "webhook_bad_timestamp"
  | "webhook_stale"
  | "webhook_bad_signature"
  | "webhook_bad_secret"
  | "webhook_body_too_large"
  | "webhook_malformed";

/** Result of signature verification; the webhook id is an opaque Svix message id. */
export type WebhookVerification =
  | { ok: true; webhookId: string }
  | { ok: false; reason: WebhookRejectReason };

/** The fields CAF-GPT uses from an inbox.email.received event (all opaque ids or addresses). */
export interface InboxEmailReceivedEvent {
  type: "inbox.email.received";
  inboxId: string;
  threadId: string;
  emailId: string;
  /** Absent when the email was deleted before the event was delivered. */
  email?: {
    direction: "inbound" | "outbound";
    /** RFC 5322 From value, display name included. */
    from: string;
    /** Inbox addresses the email was delivered to. */
    to: string[];
    /** Reply-To addresses of the email (empty when it has none). */
    replyTo: string[];
  };
}

/** Parsed webhook event: a received inbox email, or another event type CAF-GPT ignores. */
export type ParsedWebhookEvent =
  | { ok: true; event: InboxEmailReceivedEvent }
  | { ok: true; event: { type: "ignored" } }
  | { ok: false; reason: "webhook_malformed" };

const SECRET_PREFIX = "whsec_";
const TIMESTAMP_PATTERN = /^\d{1,12}$/;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const encoder = new TextEncoder();

const OpaqueIdSchema = z.string().regex(ID_PATTERN);

const InboxEmailReceivedSchema = z.object({
  type: z.literal("inbox.email.received"),
  data: z.object({
    inbox_id: OpaqueIdSchema,
    thread_id: OpaqueIdSchema,
    email_id: OpaqueIdSchema,
    email: z
      .object({
        direction: z.enum(["inbound", "outbound"]),
        from: z.string().max(2000),
        to: z.array(z.string().max(2000)).max(100),
        reply_to: z.array(z.string().max(2000)).max(100).nullish(),
      })
      .nullish(),
  }),
});

const WebhookTypeSchema = z.object({ type: z.string().max(200) });

/** Decodes standard base64 to bytes; undefined when the input is not valid base64. */
function decodeBase64(value: string): Uint8Array | undefined {
  try {
    const binary = atob(value);

    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return undefined;
  }
}

/** Imports the webhook signing secret as an HMAC-SHA256 verify key, or undefined when malformed. */
async function importSigningKey(secret: string): Promise<CryptoKey | undefined> {
  const encoded = secret.startsWith(SECRET_PREFIX) ? secret.slice(SECRET_PREFIX.length) : secret;
  const keyBytes = decodeBase64(encoded);

  if (!keyBytes || keyBytes.length === 0) return undefined;

  return await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, [
    "verify",
  ]);
}

/** Reads the Svix header, falling back to its Standard Webhooks `webhook-*` alias. */
function readSignatureHeader(headers: Headers, name: "id" | "timestamp" | "signature"): string {
  return (headers.get(`svix-${name}`) ?? headers.get(`webhook-${name}`) ?? "").trim();
}

/**
 * Verifies a Resend webhook: required headers, a timestamp within the tolerance, and at least one
 * `v1` signature that matches the raw body (Web Crypto verify, constant time).
 * @param secret - Webhook signing secret from the Resend dashboard (`whsec_...`)
 * @param headers - Request headers
 * @param rawBody - Raw request body, exactly as received
 * @param nowMs - Current epoch milliseconds
 */
export async function verifyResendWebhook(
  secret: string,
  headers: Headers,
  rawBody: string,
  nowMs: number
): Promise<WebhookVerification> {
  const webhookId = readSignatureHeader(headers, "id");
  const timestamp = readSignatureHeader(headers, "timestamp");
  const signatureHeader = readSignatureHeader(headers, "signature");

  if (!webhookId || !timestamp || !signatureHeader) {
    return { ok: false, reason: "webhook_missing_headers" };
  }

  if (!ID_PATTERN.test(webhookId) || !TIMESTAMP_PATTERN.test(timestamp)) {
    return { ok: false, reason: "webhook_bad_timestamp" };
  }

  if (Math.abs(nowMs / 1000 - Number(timestamp)) > RESEND_WEBHOOK_TOLERANCE_SECONDS) {
    return { ok: false, reason: "webhook_stale" };
  }

  const key = await importSigningKey(secret);

  if (!key) return { ok: false, reason: "webhook_bad_secret" };

  const signedContent = encoder.encode(`${webhookId}.${timestamp}.${rawBody}`);

  for (const entry of signatureHeader.split(" ")) {
    const [version, signature] = entry.split(",", 2);

    if (version !== "v1" || !signature) continue;
    const signatureBytes = decodeBase64(signature);

    if (!signatureBytes) continue;

    if (await crypto.subtle.verify("HMAC", key, signatureBytes, signedContent)) {
      return { ok: true, webhookId };
    }
  }

  return { ok: false, reason: "webhook_bad_signature" };
}

/** Parses JSON text, or returns undefined when it is not JSON. */
function parseJson(text: string): ReturnType<typeof JSON.parse> {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Parses a verified webhook body. inbox.email.received yields the ids and the sender/recipient
 * fields; any other well-formed event type is reported as ignored; anything else is malformed.
 * @param rawBody - Verified raw request body
 */
export function parseResendWebhookEvent(rawBody: string): ParsedWebhookEvent {
  const json = parseJson(rawBody);
  const typed = WebhookTypeSchema.safeParse(json);

  if (!typed.success) return { ok: false, reason: "webhook_malformed" };

  if (typed.data.type !== "inbox.email.received") return { ok: true, event: { type: "ignored" } };

  const parsed = InboxEmailReceivedSchema.safeParse(json);

  if (!parsed.success) return { ok: false, reason: "webhook_malformed" };

  const { data } = parsed.data;

  const event: InboxEmailReceivedEvent = {
    type: "inbox.email.received",
    inboxId: data.inbox_id,
    threadId: data.thread_id,
    emailId: data.email_id,
  };

  if (data.email) {
    event.email = {
      direction: data.email.direction,
      from: data.email.from,
      to: data.email.to,
      replyTo: data.email.reply_to ?? [],
    };
  }

  return { ok: true, event };
}
