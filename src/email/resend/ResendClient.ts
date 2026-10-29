/**
 * src/email/resend/ResendClient.ts
 *
 * Minimal Resend REST client for the inbox mail path, built on fetch (no SDK dependency, so it
 * runs unchanged on Workers and tests mock fetch only). Requests never carry or log email content
 * beyond the reply body itself; failures throw ResendAPIError with only the operation and the HTTP
 * status, never the response body.
 * Docs (all on https://resend.com/docs/api-reference):
 * - inboxes/get-inbox: GET /inboxes/{inbox_id}
 * - emails/retrieve-received-email: GET /emails/receiving/{email_id} (authentication, raw URL)
 * - inboxes/reply-thread-email: POST /inboxes/{inbox}/threads/{thread}/emails/{email}/reply
 * - emails/retrieve-email: GET /emails/{email_id} (message_id of a sent email)
 *
 * Top-level declarations:
 * - RESEND_API_BASE_URL: Resend REST API origin
 * - RESEND_RAW_EMAIL_MAX_BYTES: Largest raw MIME download accepted
 * - ResendFetch: Injectable fetch signature (globalThis.fetch by default)
 * - AuthenticationVerdict: SPF/DKIM/DMARC result values Resend reports
 * - ReceivedEmailInfo: Authentication results plus the raw MIME download URL of a received email
 * - ThreadReplyRequest: Body of a thread reply request
 * - ResendClient: Fetch-based client for the inbox endpoints CAF-GPT uses
 */

import { z } from "zod";
import { ResendAPIError, type ResendOperation } from "../../errors";

/** Resend REST API origin. */
export const RESEND_API_BASE_URL = "https://api.resend.com";

/** Largest raw MIME download accepted (Resend caps a whole email at 40 MB). */
export const RESEND_RAW_EMAIL_MAX_BYTES = 40 * 1024 * 1024;

/** Injectable fetch signature; defaults to globalThis.fetch. */
export type ResendFetch = (input: string, init?: RequestInit) => Promise<Response>;

/** SPF/DKIM/DMARC result values Resend computes on receipt (not taken from message headers). */
export type AuthenticationVerdict = "pass" | "fail" | "gray" | "processing_failed" | "unknown";

/** Authentication results plus the raw MIME download URL of one received email. */
export interface ReceivedEmailInfo {
  /** Null for emails Resend received before it started recording authentication. */
  authentication: {
    spf: AuthenticationVerdict;
    dkim: AuthenticationVerdict;
    dmarc: AuthenticationVerdict;
  } | null;
  rawDownloadUrl?: string;
}

/** Body of a thread reply request (Resend's snake_case field names). */
export interface ThreadReplyRequest {
  subject: string;
  html?: string;
  text: string;
  cc?: string[];
  /** Resend sets In-Reply-To, References and Reply-To itself and rejects them here. */
  headers?: Record<string, string>;
  reply_all: boolean;
}

const VerdictSchema = z
  .enum(["pass", "fail", "gray", "processing_failed", "unknown"])
  .catch("unknown");

const InboxResponseSchema = z.object({ email_address: z.string().min(3).max(320) });

const ReceivedEmailResponseSchema = z.object({
  authentication: z
    .object({ spf: VerdictSchema, dkim: VerdictSchema, dmarc: VerdictSchema })
    .nullish()
    .catch(null),
  raw: z.object({ download_url: z.string().url() }).nullish().catch(null),
});

const ReplyResponseSchema = z.object({ id: z.string().min(1).max(128) });

const SentEmailResponseSchema = z.object({
  message_id: z.string().max(998).nullish().catch(null),
});

/** Fetch-based client for the Resend inbox endpoints CAF-GPT uses. */
export class ResendClient {
  private readonly apiKey: string;
  private readonly fetcher: ResendFetch;

  /**
   * @param apiKey - RESEND_API_KEY from the Worker env (never committed)
   * @param fetcher - fetch implementation; tests pass a mock
   */
  constructor(apiKey: string, fetcher: ResendFetch = (input, init) => fetch(input, init)) {
    this.apiKey = apiKey;
    this.fetcher = fetcher;
  }

  /** Sends one authenticated JSON request and returns the parsed body, or throws ResendAPIError. */
  private async request<Result>(
    operation: ResendOperation,
    path: string,
    schema: z.ZodType<Result>,
    init: RequestInit
  ): Promise<Result> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${this.apiKey}`);
    headers.set("User-Agent", "caf-gpt-email");

    if (init.body !== undefined) headers.set("Content-Type", "application/json");

    let response: Response;

    try {
      response = await this.fetcher(`${RESEND_API_BASE_URL}${path}`, { ...init, headers });
    } catch {
      throw new ResendAPIError(operation, 0);
    }

    if (!response.ok) {
      await response.body?.cancel();
      throw new ResendAPIError(operation, response.status);
    }

    const parsed = schema.safeParse(await response.json().catch(() => undefined));

    if (!parsed.success) throw new ResendAPIError(operation, response.status);

    return parsed.data;
  }

  /**
   * Reads an inbox's address (the address replies are sent from).
   * @param inboxId - Inbox id from the webhook
   */
  async getInboxAddress(inboxId: string): Promise<string> {
    const inbox = await this.request(
      "get_inbox",
      `/inboxes/${encodeURIComponent(inboxId)}`,
      InboxResponseSchema,
      {
        method: "GET",
      }
    );

    return inbox.email_address;
  }

  /**
   * Reads a received email's authentication results and raw MIME download URL.
   * @param emailId - Email id from the webhook
   */
  async getReceivedEmail(emailId: string): Promise<ReceivedEmailInfo> {
    const email = await this.request(
      "get_received_email",
      `/emails/receiving/${encodeURIComponent(emailId)}`,
      ReceivedEmailResponseSchema,
      { method: "GET" }
    );

    const info: ReceivedEmailInfo = { authentication: email.authentication ?? null };

    if (email.raw?.download_url) info.rawDownloadUrl = email.raw.download_url;

    return info;
  }

  /**
   * Downloads the raw MIME of a received email from its signed URL. The URL is pre-signed, so no
   * API key is sent with it; only https URLs are fetched.
   * @param downloadUrl - raw.download_url from getReceivedEmail
   */
  async downloadRawEmail(downloadUrl: string): Promise<Uint8Array> {
    if (!downloadUrl.startsWith("https://")) throw new ResendAPIError("download_raw", 0);

    let response: Response;

    try {
      response = await this.fetcher(downloadUrl, { method: "GET" });
    } catch {
      throw new ResendAPIError("download_raw", 0);
    }

    if (!response.ok) {
      await response.body?.cancel();
      throw new ResendAPIError("download_raw", response.status);
    }

    const declaredBytes = Number(response.headers.get("content-length") ?? "0");

    if (declaredBytes > RESEND_RAW_EMAIL_MAX_BYTES) {
      await response.body?.cancel();
      throw new ResendAPIError("download_raw", response.status);
    }

    const raw = new Uint8Array(await response.arrayBuffer());

    if (raw.byteLength === 0 || raw.byteLength > RESEND_RAW_EMAIL_MAX_BYTES) {
      throw new ResendAPIError("download_raw", response.status);
    }

    return raw;
  }

  /**
   * Replies to one email in an inbox thread. Resend sends from the inbox address, to the
   * message's Reply-To (else its sender), and sets In-Reply-To/References itself.
   * @param inboxId - Inbox id
   * @param threadId - Thread id
   * @param emailId - Email id being answered
   * @param reply - Reply body
   * @param idempotencyKey - Stable key so a retried request never sends twice (kept 24 h by Resend)
   * @returns The Resend id of the sent reply
   */
  async replyToThreadEmail(
    inboxId: string,
    threadId: string,
    emailId: string,
    reply: ThreadReplyRequest,
    idempotencyKey: string
  ): Promise<string> {
    const path = `/inboxes/${encodeURIComponent(inboxId)}/threads/${encodeURIComponent(threadId)}/emails/${encodeURIComponent(emailId)}/reply`;

    const result = await this.request("reply", path, ReplyResponseSchema, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey.slice(0, 256) },
      body: JSON.stringify(reply),
    });

    return result.id;
  }

  /**
   * Reads the RFC 5322 Message-ID Resend assigned a sent email, if it has one yet.
   * @param sentEmailId - Resend id returned by replyToThreadEmail
   */
  async getSentMessageId(sentEmailId: string): Promise<string | undefined> {
    const email = await this.request(
      "get_sent_email",
      `/emails/${encodeURIComponent(sentEmailId)}`,
      SentEmailResponseSchema,
      { method: "GET" }
    );

    return email.message_id ?? undefined;
  }
}
