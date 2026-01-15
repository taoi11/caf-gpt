/**
 * src/index.ts
 *
 * Entry point for Cloudflare Worker with Resend webhook handling
 *
 * Top-level functions:
 * - fetch: HTTP handler for Resend webhooks and health checks
 * - default: Default export for Cloudflare Worker
 */

import { createConfig } from "./config";
import { formatError, Logger } from "./Logger";
import { ResendWebhookHandler } from "./webhooks/ResendWebhookHandler";

async function fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const startTime = Date.now();
  const logger = Logger.getInstance();
  const config = createConfig(env);
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

    if (url.pathname === config.email.webhookPath && request.method === "POST") {
      const webhookHandler = new ResendWebhookHandler(
        env,
        env.RESEND_API_KEY,
        env.RESEND_WEBHOOK_SECRET,
        config
      );

      return await webhookHandler.handleWebhook(request, ctx);
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
        message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export default {
  fetch,
};
