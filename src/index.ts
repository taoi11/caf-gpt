/**
 * src/index.ts
 *
 * Entry point for Cloudflare Worker with HTTP and Agent-routed Email Worker handlers
 *
 * Top-level functions:
 * - UserAgent: Durable Object-backed per-user email agent
 * - createUserAgentResolver: Creates the Agents SDK email resolver for direct and signed reply routing
 * - isAuthorizedSender: Checks configured sender allow list
 * - isMonitoredRecipient: Checks monitored recipient addresses
 * - fetch: HTTP handler for health checks and static assets
 * - email: Email Worker handler for inbound email processing
 * - default: Default export for Cloudflare Worker
 */

import { routeAgentEmail } from "agents";
import { createSecureReplyEmailResolver, type EmailResolver } from "agents/email";
import { getUserAgentId, UserAgent } from "./agents/UserAgent";
import { createConfig } from "./config";
import { normalizeEmailAddress } from "./email/utils/EmailNormalizer";
import { formatError, Logger } from "./Logger";

export { UserAgent };

/** Creates the Agents SDK email resolver for direct and signed reply routing. */
export function createUserAgentResolver(env: Env): EmailResolver<Env> {
  const logger = Logger.getInstance();
  const config = createConfig(env);
  const secureReplyResolver = createSecureReplyEmailResolver<Env>(env.EMAIL_SECRET, {
    onInvalidSignature: (emailMessage, reason) => {
      if (reason === "missing_headers") {
        logger.info("No signed email routing headers; using direct email routing", {
          from: emailMessage.from,
          to: emailMessage.to,
          reason,
        });
        return;
      }

      logger.warn("Invalid signed email routing headers", {
        from: emailMessage.from,
        to: emailMessage.to,
        reason,
      });
    },
  });

  return async (emailMessage, resolverEnv) => {
    const senderEmail = normalizeEmailAddress(emailMessage.from);
    if (!isAuthorizedSender(senderEmail, config)) {
      logger.info("Email ignored - sender not authorized", {
        sender: emailMessage.from,
        normalizedSender: senderEmail,
      });
      return null;
    }

    const recipientEmail = normalizeEmailAddress(emailMessage.to);
    if (!isMonitoredRecipient(recipientEmail, config)) {
      logger.info("Email ignored - recipient not monitored", {
        recipient: emailMessage.to,
        normalizedRecipient: recipientEmail,
      });
      return null;
    }

    const signedRoute = await secureReplyResolver(emailMessage, resolverEnv);
    if (signedRoute) {
      return signedRoute;
    }

    return {
      agentName: "UserAgent",
      agentId: getUserAgentId(senderEmail),
    };
  };
}

/** Checks configured sender allow list. */
function isAuthorizedSender(senderEmail: string, config = createConfig()): boolean {
  const isAuthorizedDomain = config.authorization.authorizedDomains.some((domain) =>
    senderEmail.endsWith(`@${domain}`)
  );
  const isAuthorizedEmail = config.authorization.authorizedEmails.some(
    (emailAddress) => senderEmail === normalizeEmailAddress(emailAddress)
  );

  return isAuthorizedDomain || isAuthorizedEmail;
}

/** Checks monitored recipient addresses. */
function isMonitoredRecipient(recipientEmail: string, config = createConfig()): boolean {
  return config.email.monitoredAddresses.some(
    (address) => recipientEmail === normalizeEmailAddress(address)
  );
}

/** Handles HTTP health checks and static assets. */
async function fetch(request: Request, env: Env): Promise<Response> {
  const startTime = Date.now();
  const logger = Logger.getInstance();
  const url = new URL(request.url);

  logger.info("Request received", {
    method: request.method,
    pathname: url.pathname,
  });

  try {
    // Block public access to internal prompts (still available via ASSETS binding internally)
    if (url.pathname.startsWith("/prompts/")) {
      return new Response("Not Found", { status: 404 });
    }

    if (url.pathname === "/health" && request.method === "GET") {
      return new Response("OK", { status: 200 });
    }

    // Prevent 404 for favicon requests
    if (url.pathname === "/favicon.ico") {
      return new Response(null, { status: 204 });
    }

    return env.ASSETS.fetch(request);
  } catch (error) {
    const { message, stack } = formatError(error);

    logger.error(`Request processing failed: ${message}`, {
      processingTime: Date.now() - startTime,
      stack,
      pathname: url.pathname,
    });

    return new Response(
      JSON.stringify({
        error: "Internal server error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

/** Routes inbound email into the per-user UserAgent Durable Object. */
async function email(
  message: ForwardableEmailMessage,
  env: Env,
  _ctx: ExecutionContext
): Promise<void> {
  const logger = Logger.getInstance();

  try {
    await routeAgentEmail(message, env, {
      resolver: createUserAgentResolver(env),
      onNoRoute: (emailMessage) => {
        logger.warn("Email rejected - no UserAgent route", {
          from: emailMessage.from,
          to: emailMessage.to,
        });
        emailMessage.setReject("Unauthorized sender or unknown recipient");
      },
    });
  } catch (error) {
    const { message: errorMessage, stack } = formatError(error);

    logger.error(`Email processing failed: ${errorMessage}`, {
      stack,
      from: message.from,
      to: message.to,
    });

    throw error;
  }
}

export default {
  fetch,
  email,
};
