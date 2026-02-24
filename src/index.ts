/**
 * src/index.ts
 *
 * Entry point for Cloudflare Worker with HTTP and Email Worker handlers
 *
 * Top-level functions:
 * - fetch: HTTP handler for health checks and static assets
 * - email: Email Worker handler for inbound email processing
 * - default: Default export for Cloudflare Worker
 */

import { createConfig } from "./config";
import { CloudflareEmailWorkerHandler } from "./email/CloudflareEmailWorkerHandler";
import { formatError, Logger } from "./Logger";

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

async function email(
  message: ForwardableEmailMessage,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  const logger = Logger.getInstance();
  const config = createConfig(env);
  const emailHandler = new CloudflareEmailWorkerHandler(env, config);

  try {
    await emailHandler.handleEmail(message, ctx);
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
