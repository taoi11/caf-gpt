/**
 * tests/workers/resendHarness.ts
 *
 * Test harness for the Resend Inboxes mail path: builds raw MIME fixtures and the matching
 * ResendInboundTask, and mocks fetch (only fetch, no live calls) to answer the Resend endpoints
 * the UserAgent calls: GET /inboxes/{id}, GET /emails/receiving/{id}, the signed raw download URL,
 * POST .../reply, and GET /emails/{id}. Every reply request is recorded with its path,
 * Idempotency-Key and JSON body.
 *
 * Top-level declarations:
 * - InboundEmailOptions: RFC and envelope fields of one inbound fixture email
 * - InboundEmail: A fixture email: its task, raw MIME, and receive-time settings
 * - ReplyCall: One recorded reply request
 * - ResendMockOptions: Behaviour switches for the mocked Resend API
 * - ResendMock: Installed fetch mock with recorded requests and a deliver helper
 * - buildRawEmail: Builds raw MIME fixtures (Date by default, optional HTML part)
 * - createInboundEmail: Builds a fixture email and its ResendInboundTask
 * - installResendMock: Mocks fetch for the Resend endpoints and records requests
 */

import { vi } from "vitest";
import type { ThreadReplyRequest } from "../../src/email/resend/ResendClient";
import type { ResendInboundTask, UserAgent } from "../../src/agents/UserAgent";

/** RFC and envelope fields of one inbound fixture email. */
export interface InboundEmailOptions {
  /** Authenticated sender (the webhook From). */
  envelopeFrom: string;
  /** Inbox address the email arrived at. */
  envelopeTo: string;
  from: string;
  replyTo?: string[];
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  /** Date header; defaults to a fixed date, null omits it. */
  date?: string | null;
  html?: string;
  messageId?: string;
  headers?: Record<string, string>;
  rawOverride?: string;
  /** Resend email id; generated when absent (reuse one to model a repeated delivery). */
  resendEmailId?: string;
  /** Resend's receive-time results; defaults to all pass, null models a missing result. */
  authentication?: { spf: string; dkim: string; dmarc: string } | null;
  /** HTTP status the raw download returns instead of the MIME. */
  rawFailureStatus?: number;
}

/** A fixture email: its task, raw MIME, and receive-time settings. */
export interface InboundEmail {
  task: ResendInboundTask;
  raw: string;
  inboxAddress: string;
  options: InboundEmailOptions;
}

/** One recorded reply request. */
export interface ReplyCall {
  path: string;
  idempotencyKey: string;
  body: ThreadReplyRequest;
}

/** Behaviour switches for the mocked Resend API. */
export interface ResendMockOptions {
  /** HTTP status every reply request fails with. */
  replyFailureStatus?: number;
  /** Message-ID GET /emails/{id} reports for a sent reply; null models "not assigned yet". */
  sentMessageId?: (resendReplyId: string) => string | null;
}

/** Installed fetch mock with recorded requests and a deliver helper. */
export interface ResendMock {
  replies: ReplyCall[];
  /** Resend ids returned for successful replies, in order. */
  replyIds: string[];
  /** Method and path of every request, in order (no bodies). */
  requests: string[];
  register: (email: InboundEmail) => void;
  /** Registers the email and runs the UserAgent's scheduled processing for it. */
  deliver: (instance: UserAgent, email: InboundEmail) => Promise<void>;
}

const RESEND_API = "https://api.resend.com";
const RAW_HOST = "https://raw.resend.test/";
let emailCounter = 0;
// Module-wide so reply ids stay unique across harnesses (pending send times are keyed by them).

let replyCounter = 0;

/**
 * Builds raw MIME fixtures; Bcc is present only to prove it is never propagated.
 * @param options - Fixture email fields
 */
export function buildRawEmail(options: InboundEmailOptions): string {
  const headers = [
    `From: ${options.from}`,
    ...(options.replyTo?.length ? [`Reply-To: ${options.replyTo.join(", ")}`] : []),
    `To: ${options.to.join(", ")}`,
    ...(options.cc?.length ? [`Cc: ${options.cc.join(", ")}`] : []),
    ...(options.bcc?.length ? [`Bcc: ${options.bcc.join(", ")}`] : []),
    `Subject: ${options.subject}`,
    ...(options.messageId ? [`Message-ID: ${options.messageId}`] : []),
    ...(options.date === null
      ? []
      : [`Date: ${options.date ?? "Wed, 28 Oct 2026 17:29:00 +0000"}`]),
    ...Object.entries(options.headers ?? {}).map(([name, value]) => `${name}: ${value}`),
  ];

  if (options.html) {
    return [
      ...headers,
      'Content-Type: multipart/alternative; boundary="caf-gpt-test"',
      "",
      "--caf-gpt-test",
      "Content-Type: text/plain; charset=utf-8",
      "",
      options.body,
      "--caf-gpt-test",
      "Content-Type: text/html; charset=utf-8",
      "",
      options.html,
      "--caf-gpt-test--",
    ].join("\r\n");
  }

  return `${[...headers, "Content-Type: text/plain; charset=utf-8"].join("\r\n")}\r\n\r\n${options.body}`;
}

/**
 * Builds a fixture email and the ResendInboundTask the Worker would hand the UserAgent.
 * @param options - Fixture email fields
 */
export function createInboundEmail(options: InboundEmailOptions): InboundEmail {
  emailCounter++;
  const emailId = options.resendEmailId ?? `email-${emailCounter}`;
  const inboxAddress = options.envelopeTo.toLowerCase();

  return {
    task: {
      emailRef: "0123456789abcdef",
      inboxId: `inbox-${inboxAddress.split("@")[0]}`,
      threadId: `thread-${emailId}`,
      emailId,
      from: options.envelopeFrom,
      replyTo: (options.replyTo ?? []).map((address) => address.toLowerCase()),
    },
    raw: options.rawOverride ?? buildRawEmail(options),
    inboxAddress,
    options,
  };
}

/**
 * Mocks globalThis.fetch for the Resend endpoints the UserAgent calls and records requests.
 * Unknown URLs answer 404, so an unexpected call fails the test instead of reaching the network.
 * @param mockOptions - Behaviour switches
 */
export function installResendMock(mockOptions: ResendMockOptions = {}): ResendMock {
  const emails = new Map<string, InboundEmail>();
  const inboxes = new Map<string, string>();
  const replies: ReplyCall[] = [];
  const requests: string[] = [];
  const replyIds: string[] = [];

  const register = (email: InboundEmail) => {
    emails.set(email.task.emailId, email);
    inboxes.set(email.task.inboxId, email.inboxAddress);
  };

  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    const method = init?.method ?? "GET";
    requests.push(`${method} ${url.replace(RESEND_API, "")}`);

    if (url.startsWith(RAW_HOST)) {
      const email = emails.get(url.slice(RAW_HOST.length));

      if (!email) return new Response(null, { status: 404 });

      if (email.options.rawFailureStatus) {
        return new Response(null, { status: email.options.rawFailureStatus });
      }

      return new Response(email.raw, { status: 200 });
    }

    const path = url.replace(RESEND_API, "");
    const inbox = /^\/inboxes\/([^/]+)$/.exec(path);

    if (inbox && method === "GET") {
      const address = inboxes.get(inbox[1]);

      return address
        ? Response.json({ object: "inbox", id: inbox[1], email_address: address }, { status: 200 })
        : Response.json({ name: "not_found" }, { status: 404 });
    }

    const received = /^\/emails\/receiving\/([^/]+)$/.exec(path);

    if (received && method === "GET") {
      const email = emails.get(received[1]);

      if (!email) return Response.json({ name: "not_found" }, { status: 404 });

      return Response.json(
        {
          object: "email",
          id: received[1],
          authentication:
            email.options.authentication === undefined
              ? { spf: "pass", dkim: "pass", dmarc: "pass" }
              : email.options.authentication,
          raw: { download_url: `${RAW_HOST}${received[1]}`, expires_at: "2026-10-29T23:00:00Z" },
        },
        { status: 200 }
      );
    }

    if (
      /^\/inboxes\/[^/]+\/threads\/[^/]+\/emails\/[^/]+\/reply$/.test(path) &&
      method === "POST"
    ) {
      const headers = new Headers(init?.headers);

      replies.push({
        path,
        idempotencyKey: headers.get("Idempotency-Key") ?? "",
        body: JSON.parse(String(init?.body)),
      });

      if (mockOptions.replyFailureStatus) {
        return Response.json(
          { name: "application_error" },
          { status: mockOptions.replyFailureStatus }
        );
      }

      replyCounter++;
      const id = `reply-${replyCounter}`;
      replyIds.push(id);

      return Response.json({ id }, { status: 200 });
    }

    const sent = /^\/emails\/([^/]+)$/.exec(path);

    if (sent && method === "GET") {
      const messageId = mockOptions.sentMessageId
        ? mockOptions.sentMessageId(sent[1])
        : `<${sent[1]}@resend.caf-gpt.test>`;

      return Response.json(
        { object: "email", id: sent[1], message_id: messageId },
        { status: 200 }
      );
    }

    return Response.json({ name: "not_found" }, { status: 404 });
  });

  return {
    replies,
    replyIds,
    requests,
    register,
    deliver: async (instance, email) => {
      register(email);
      await instance.processResendEmail(email.task);
    },
  };
}
