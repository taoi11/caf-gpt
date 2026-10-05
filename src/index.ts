/**
 * src/index.ts
 *
 * Entry point for Cloudflare Worker with HTTP and Agent-routed Email Worker handlers
 *
 * Top-level functions:
 * - UserAgent: Durable Object-backed per-user email agent
 * - EmailBoundaryMetadata: Safe sender and recipient domain metadata for boundary logs
 * - EmailRoutingFailureMetadata: Parsed error metadata for top-level routing failures
 * - createUserAgentResolver: Creates the sender-keyed Agents SDK email resolver
 * - isAuthorizedSender: Checks configured sender allow list
 * - isMonitoredRecipient: Checks monitored recipient addresses
 * - getEmailDomain: Extracts safe normalized sender-domain metadata
 * - rejectEmailSafely: Attempts an SMTP rejection without allowing it to escape
 * - fetch: HTTP handler for health checks and static assets
 * - email: Email Worker handler for inbound email processing
 * - default: Default export for Cloudflare Worker
 */

import { routeAgentEmail } from "agents";
import type { EmailResolver } from "agents/email";
import { getUserAgentId, UserAgent } from "./agents/UserAgent";
import { createConfig } from "./config";
import { normalizeEmailAddress } from "./email/utils/EmailNormalizer";
import { isAuthorizedEmailAddress } from "./email/utils/ReplyRecipients";
import { getSafeErrorMetadata, Logger } from "./Logger";

export { UserAgent };

/** Safe sender and recipient domain metadata for inbound email boundary logs. */
interface EmailBoundaryMetadata {
  senderDomain: string;
  receivingDomain: string;
}

/** Parsed error metadata for a top-level inbound email routing failure. */
interface EmailRoutingFailureMetadata extends EmailBoundaryMetadata {
  errorName: string;
  errorCode?: string;
}

/** Creates the Agents SDK email resolver for authorized sender-keyed routing. */
export function createUserAgentResolver(env: Env, config = createConfig(env)): EmailResolver<Env> {
  const logger = Logger.getInstance();

  return async (emailMessage) => {
    const senderEmail = normalizeEmailAddress(emailMessage.from);
    if (!isAuthorizedSender(senderEmail, config)) {
      logger.info("Email ignored - sender not authorized", {
        senderDomain: getEmailDomain(senderEmail),
        receivingDomain: getEmailDomain(emailMessage.to),
      });
      return null;
    }

    const recipientEmail = normalizeEmailAddress(emailMessage.to);
    if (!isMonitoredRecipient(recipientEmail, config)) {
      logger.info("Email ignored - recipient not monitored", {
        senderDomain: getEmailDomain(senderEmail),
        receivingDomain: getEmailDomain(recipientEmail),
      });
      return null;
    }

    logger.info("Email routed", {
      route: "email",
      status: "routed",
      senderDomain: getEmailDomain(senderEmail),
    });

    return {
      agentName: "UserAgent",
      agentId: getUserAgentId(senderEmail),
    };
  };
}

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

/** Extracts safe normalized domain metadata from an email address. */
function getEmailDomain(address: string): string {
  const normalized = normalizeEmailAddress(address);
  return normalized.includes("@") ? normalized.slice(normalized.lastIndexOf("@") + 1) : "";
}

/** Attempts an SMTP rejection without allowing platform errors to escape. */
function rejectEmailSafely(
  message: ForwardableEmailMessage,
  reason: string,
  logger: Logger,
  context: EmailBoundaryMetadata
): void {
  try {
    message.setReject(reason);
  } catch (error) {
    logger.error("Email rejection failed", {
      ...context,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }
}

/** Handles HTTP health checks and static assets. */
async function fetch(request: Request, env: Env): Promise<Response> {
  const startTime = Date.now();
  const logger = Logger.getInstance();
  const url = new URL(request.url);
  let response: Response;
  let outcome: "prompts-blocked" | "health" | "favicon" | "error" | "asset";

  try {
    // Block public access to internal prompts (still available via ASSETS binding internally)
    if (url.pathname.startsWith("/prompts/")) {
      response = new Response("Not Found", { status: 404 });
      outcome = "prompts-blocked";
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

/** Routes inbound email into the per-user UserAgent Durable Object. */
async function email(
  message: ForwardableEmailMessage,
  env: Env,
  _ctx: ExecutionContext
): Promise<void> {
  const logger = Logger.getInstance();
  const metadata = {
    senderDomain: getEmailDomain(message.from),
    receivingDomain: getEmailDomain(message.to),
  } satisfies EmailBoundaryMetadata;

  if (!env.EMAIL) {
    logger.error("Email service configuration unavailable", {
      ...metadata,
      missingEmailBinding: !env.EMAIL,
    });
    rejectEmailSafely(message, "Service temporarily unavailable", logger, metadata);
    return;
  }

  let config: ReturnType<typeof createConfig>;
  try {
    config = createConfig(env);
  } catch (error) {
    logger.error("Email authorization configuration unavailable", {
      ...metadata,
      ...getSafeErrorMetadata(error),
    });
    rejectEmailSafely(message, "Service temporarily unavailable", logger, metadata);
    return;
  }

  try {
    await routeAgentEmail(message, env, {
      resolver: createUserAgentResolver(env, config),
      onNoRoute: (emailMessage) => {
        logger.warn("Email rejected - no UserAgent route", {
          ...metadata,
        });
        rejectEmailSafely(
          emailMessage,
          "Unauthorized sender or unknown recipient",
          logger,
          metadata
        );
      },
    });
  } catch (error) {
    const { errorName, errorCode } = getSafeErrorMetadata(error);
    const failureMetadata: EmailRoutingFailureMetadata = {
      ...metadata,
      errorName,
    };
    if (errorCode !== undefined) {
      failureMetadata.errorCode = errorCode;
    }
    logger.error("Top-level email routing failed", failureMetadata);
    rejectEmailSafely(message, "Service temporarily unavailable", logger, metadata);
  }
}

export default {
  fetch,
  email,
};
