/**
 * tests/mocks/resendWebhook.ts
 *
 * Test-only Resend (Svix) webhook fixtures: a placeholder signing secret, an inbox.email.received
 * payload builder, and a signer that produces the svix-id/svix-timestamp/svix-signature headers
 * exactly as https://resend.com/docs/webhooks/verify-webhooks-requests describes.
 *
 * Top-level declarations:
 * - TEST_WEBHOOK_SECRET: Placeholder whsec_ secret (matches the workers test binding)
 * - ReceivedEventOptions: Overrides for the inbox.email.received fixture
 * - buildReceivedEvent: Builds an inbox.email.received JSON body
 * - signResendWebhook: Signs a body and returns the Svix headers
 */

/** Placeholder whsec_ secret; the workers test config binds the same value. */
export const TEST_WEBHOOK_SECRET = "whsec_dGVzdC13ZWJob29rLXNpZ25pbmctc2VjcmV0";

/** Overrides for the inbox.email.received fixture. */
export interface ReceivedEventOptions {
  type?: string;
  emailId?: string;
  from?: string;
  to?: string[];
  replyTo?: string[];
  direction?: "inbound" | "outbound";
  omitEmail?: boolean;
}

/**
 * Builds an inbox.email.received JSON body shaped like
 * https://resend.com/docs/webhooks/inboxes/email-received.
 * @param options - Fixture overrides
 */
export function buildReceivedEvent(options: ReceivedEventOptions = {}): string {
  const emailId = options.emailId ?? "56761188-7520-42d8-8898-ff6fc54ce618";

  return JSON.stringify({
    type: options.type ?? "inbox.email.received",
    created_at: "2026-10-29T15:00:00.000Z",
    data: {
      inbox_id: "a1b2c3d4-0000-4000-8000-000000000001",
      thread_id: "a1b2c3d4-0000-4000-8000-000000000002",
      email_id: emailId,
      created_at: "2026-10-29T15:00:00.000Z",
      email: options.omitEmail
        ? null
        : {
            id: emailId,
            direction: options.direction ?? "inbound",
            from: options.from ?? "Member Name <member@forces.gc.ca>",
            to: options.to ?? ["agent@caf-gpt.com"],
            cc: [],
            bcc: [],
            reply_to: options.replyTo ?? [],
            subject: "Private subject",
            message_id: "<private-id@forces.gc.ca>",
          },
    },
  });
}

/**
 * Signs a webhook body: base64 HMAC-SHA256 over `${id}.${timestamp}.${body}` keyed by the
 * base64-decoded part of the secret after `whsec_`.
 * @param body - Raw JSON body
 * @param timestampSeconds - Unix seconds for svix-timestamp
 * @param secret - whsec_ signing secret
 * @param webhookId - svix-id value
 */
export async function signResendWebhook(
  body: string,
  timestampSeconds: number,
  secret: string = TEST_WEBHOOK_SECRET,
  webhookId = "msg_2Lh9KRb0pzN4LePd3XiA4cUuWsd"
): Promise<Headers> {
  const keyBytes = Uint8Array.from(atob(secret.slice("whsec_".length)), (character) =>
    character.charCodeAt(0)
  );

  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${webhookId}.${timestampSeconds}.${body}`)
  );

  const encoded = btoa(String.fromCharCode(...new Uint8Array(signature)));

  return new Headers({
    "content-type": "application/json",
    "svix-id": webhookId,
    "svix-timestamp": String(timestampSeconds),
    "svix-signature": `v1,${encoded}`,
  });
}
