/**
 * src/index.ts
 *
 * Entry point for the Cloudflare Worker: HTTP health/static routes and the Resend Inboxes webhook
 * that hands inbound email to the sender's UserAgent Durable Object. There is no Email Routing
 * handler; Resend is the only mail path, and a missing secret fails loudly (500, so Resend retries
 * once it is configured).
 *
 * Top-level declarations:
 * - UserAgent: Durable Object-backed per-user email agent
 * - RESEND_WEBHOOK_PATH: Path Resend posts inbox.email.received events to
 * - EmailBoundaryMetadata: Safe sender/recipient domain and emailRef metadata for boundary logs
 * - WebhookOutcome: Fixed outcome codes for the webhook route
 * - isAuthorizedSender: Checks configured sender allow list
 * - isMonitoredRecipient: Checks monitored recipient addresses
 * - readBoundedBody: Reads the raw request body, refusing bodies over the size limit
 * - jsonResponse: Small JSON response with a fixed, content-free outcome code
 * - handleResendWebhook: Verifies a Resend webhook and routes the email to its UserAgent
 * - fetch: HTTP handler for the webhook, health checks and static assets
 * - default: Default export for Cloudflare Worker
 */

import { getAgentByName } from "agents";
import { getUserAgentId, UserAgent } from "./agents/UserAgent";
import { createConfig } from "./config";
import {
  parseResendWebhookEvent,
  RESEND_WEBHOOK_MAX_BODY_BYTES,
  verifyResendWebhook,
  type WebhookRejectReason,
} from "./email/resend/ResendWebhook";
import { normalizeEmailAddress } from "./email/utils/EmailNormalizer";
import { createEmailRef, getLogSafeDomain, toLoggableResendId } from "./email/utils/LogRedaction";
import { isAuthorizedEmailAddress } from "./email/utils/ReplyRecipients";
import { getSafeErrorMetadata, Logger } from "./Logger";

export { UserAgent };

/** Path Resend posts inbox.email.received events to (the webhook endpoint URL's path). */
export const RESEND_WEBHOOK_PATH = "/webhooks/resend";

/** Safe sender/recipient domains plus the content-free emailRef for inbound boundary logs. */
interface EmailBoundaryMetadata {
  emailRef: string;
  senderDomain: string;
  receivingDomain: string;
}

/** Fixed outcome codes for the webhook route (logged and returned; never content). */
type WebhookOutcome =
  | WebhookRejectReason
  | "webhook_misconfigured"
  | "event_ignored"
  | "email_missing"
  | "outbound_ignored"
  | "sender_not_authorized"
  | "recipient_not_monitored"
  | "accepted"
  | "duplicate"
  | "routing_failed";

/** Checks configured sender allow list. */
function isAuthorizedSender(senderEmail: string, config: ReturnType<typeof createConfig>): boolean {
  return isAuthorizedEmailAddress(senderEmail, config.authorization);
}

/** Checks monitored recipient addresses. */
function isMonitoredRecipient(
  recipientEmail: string,
  config: ReturnType<typeof createConfig>
): boolean {
  return config.email.monitoredAddresses.some(
    (address) => recipientEmail === normalizeEmailAddress(address)
  );
}

/** Reads the raw request body as text, or undefined when it is over the size limit. */
async function readBoundedBody(request: Request): Promise<string | undefined> {
  const declared = Number(request.headers.get("content-length") ?? "0");

  if (declared > RESEND_WEBHOOK_MAX_BODY_BYTES) return undefined;
  const body = await request.text();

  return new TextEncoder().encode(body).byteLength > RESEND_WEBHOOK_MAX_BODY_BYTES
    ? undefined
    : body;
}

/** Small JSON response carrying only a fixed outcome code. */
function jsonResponse(status: number, outcome: WebhookOutcome): Response {
  return new Response(JSON.stringify({ outcome }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Verifies a Resend webhook and routes an inbound inbox email to the sender's UserAgent.
 * Unsigned, badly signed, stale or malformed requests get a 4xx with a fixed reason; events
 * CAF-GPT does not act on get a 200 so Resend does not retry them; a routing failure gets a 500
 * so Resend retries (the UserAgent deduplicates by email id, so a retry never replies twice).
 * Docs: https://resend.com/docs/webhooks/verify-webhooks-requests
 */
async function handleResendWebhook(request: Request, env: Env): Promise<Response> {
  const logger = Logger.getInstance();

  if (!env.RESEND_WEBHOOK_SECRET || !env.RESEND_API_KEY) {
    logger.error("Resend webhook rejected", {
      reason: "webhook_misconfigured",
      missingWebhookSecret: !env.RESEND_WEBHOOK_SECRET,
      missingApiKey: !env.RESEND_API_KEY,
    });

    return jsonResponse(500, "webhook_misconfigured");
  }

  const rawBody = await readBoundedBody(request);

  if (rawBody === undefined) {
    logger.warn("Resend webhook rejected", { reason: "webhook_body_too_large" });

    return jsonResponse(413, "webhook_body_too_large");
  }

  const verification = await verifyResendWebhook(
    env.RESEND_WEBHOOK_SECRET,
    request.headers,
    rawBody,
    Date.now()
  );

  if (!verification.ok) {
    if (verification.reason === "webhook_bad_secret") {
      logger.error("Resend webhook rejected", { reason: verification.reason });

      return jsonResponse(500, verification.reason);
    }

    logger.warn("Resend webhook rejected", { reason: verification.reason });

    return jsonResponse(
      verification.reason === "webhook_missing_headers" ? 400 : 401,
      verification.reason
    );
  }

  const parsed = parseResendWebhookEvent(rawBody);

  if (!parsed.ok) {
    logger.warn("Resend webhook rejected", { reason: parsed.reason });

    return jsonResponse(400, parsed.reason);
  }

  if (parsed.event.type !== "inbox.email.received") {
    logger.info("Resend webhook ignored", { reason: "event_ignored" });

    return jsonResponse(200, "event_ignored");
  }

  const { event } = parsed;
  const emailRef = createEmailRef();

  if (!event.email) {
    logger.info("Resend webhook ignored", {
      emailRef,
      reason: "email_missing",
      resendEmailId: toLoggableResendId(event.emailId),
    });

    return jsonResponse(200, "email_missing");
  }

  const senderEmail = normalizeEmailAddress(event.email.from);
  const recipients = event.email.to.map((address) => normalizeEmailAddress(address));

  const metadata: EmailBoundaryMetadata = {
    emailRef,
    senderDomain: getLogSafeDomain(senderEmail),
    receivingDomain: getLogSafeDomain(recipients[0]),
  };

  if (event.email.direction !== "inbound") {
    logger.info("Resend webhook ignored", { ...metadata, reason: "outbound_ignored" });

    return jsonResponse(200, "outbound_ignored");
  }

  const config = createConfig(env);

  if (!isAuthorizedSender(senderEmail, config)) {
    logger.info("Email ignored - sender not authorized", metadata);

    return jsonResponse(200, "sender_not_authorized");
  }

  if (!recipients.some((recipient) => isMonitoredRecipient(recipient, config))) {
    logger.info("Email ignored - recipient not monitored", metadata);

    return jsonResponse(200, "recipient_not_monitored");
  }

  logger.info("Email routed", {
    ...metadata,
    route: "resend_webhook",
    status: "routed",
    resendEmailId: toLoggableResendId(event.emailId),
  });

  try {
    const agent = await getAgentByName(env.UserAgent, getUserAgentId(senderEmail));

    const acceptance = await agent.receiveResendEmail({
      emailRef,
      inboxId: event.inboxId,
      threadId: event.threadId,
      emailId: event.emailId,
      from: senderEmail,
      replyTo: event.email.replyTo.map((address) => normalizeEmailAddress(address)),
    });

    logger.info("Email handed off to UserAgent", { ...metadata, acceptance });

    return jsonResponse(200, acceptance);
  } catch (error) {
    logger.error("Top-level email routing failed", {
      ...metadata,
      ...getSafeErrorMetadata(error),
    });

    return jsonResponse(500, "routing_failed");
  }
}

/** Handles the Resend webhook, HTTP health checks and static assets. */
async function fetch(request: Request, env: Env): Promise<Response> {
  const startTime = Date.now();
  const logger = Logger.getInstance();
  const url = new URL(request.url);
  let response: Response;
  let outcome: "prompts-blocked" | "health" | "favicon" | "webhook" | "error" | "asset";

  try {
    // Block public access to internal prompts (still available via ASSETS binding internally)
    if (url.pathname.startsWith("/prompts/")) {
      response = new Response("Not Found", { status: 404 });
      outcome = "prompts-blocked";
    } else if (url.pathname === RESEND_WEBHOOK_PATH) {
      response =
        request.method === "POST"
          ? await handleResendWebhook(request, env)
          : new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
      outcome = "webhook";
    } else if (url.pathname === "/health" && request.method === "GET") {
      response = new Response("OK", { status: 200 });
      outcome = "health";
    } else if (url.pathname === "/favicon.ico") {
      response = new Response(null, { status: 204 });
      outcome = "favicon";
    } else {
      response = await env.ASSETS.fetch(request);
      outcome = response.status >= 500 ? "error" : "asset";
    }
  } catch (error) {
    logger.error("Request processing failed", {
      processingTime: Date.now() - startTime,
      ...getSafeErrorMetadata(error),
    });

    response = new Response(
      JSON.stringify({
        error: "Internal server error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
    outcome = "error";
  }

  logger.info("Request completed", {
    route: url.pathname,
    status: response.status,
    outcome,
  });

  return response;
}

export default {
  fetch,
};
