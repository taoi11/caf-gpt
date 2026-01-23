/**
 * src/webhooks/ResendWebhookHandler.ts
 *
 * Handles incoming Resend webhooks for email.received events
 *
 * Top-level declarations:
 * - ResendWebhookHandler: Webhook handler with signature verification and email fetching
 * - handleWebhook: Main entry point for processing webhook events
 * - verifyWebhookSignature: Verify Svix signature for security
 * - fetchFullEmail: Retrieve complete email content from Resend API
 * - convertToInternalFormat: Transform Resend email to ParsedEmailData
 * - isAuthorizedSender: Check if sender is authorized
 * - isMonitoredRecipient: Check if recipient address is monitored
 */

import { Resend } from "resend";
import type { AppConfig } from "../config";
import { SimpleEmailHandler } from "../email/SimpleEmailHandler";
import type { ParsedEmailData } from "../email/types";
import { normalizeEmailAddress } from "../email/utils/EmailNormalizer";
import { APIAuthError, APITimeoutError, APIValidationError, isTypedAPIError } from "../errors";
import { formatError, Logger } from "../Logger";
import type { ResendEmailReceivedEvent, ResendFullEmail, ResendWebhookEvent } from "./types";

export class ResendWebhookHandler {
  private readonly resend: Resend;
  private readonly config: AppConfig;
  private readonly logger: Logger;
  private readonly webhookSecret: string;
  private readonly emailHandler: SimpleEmailHandler;

  constructor(
    env: Env,
    apiKey: string,
    webhookSecret: string,
    config: AppConfig,
    emailHandler?: SimpleEmailHandler
  ) {
    this.resend = new Resend(apiKey);
    this.config = config;
    this.logger = Logger.getInstance();
    this.webhookSecret = webhookSecret;
    this.emailHandler = emailHandler || new SimpleEmailHandler(env, config);
  }

  async handleWebhook(request: Request, ctx?: ExecutionContext): Promise<Response> {
    const startTime = Date.now();

    try {
      const rawBody = await request.text();
      const svixId = request.headers.get("svix-id");
      const svixTimestamp = request.headers.get("svix-timestamp");
      const svixSignature = request.headers.get("svix-signature");

      if (!svixId || !svixTimestamp || !svixSignature) {
        this.logger.warn("Missing Svix headers in webhook request", {
          hasSvixId: !!svixId,
          hasSvixTimestamp: !!svixTimestamp,
          hasSvixSignature: !!svixSignature,
        });
        return new Response("Missing required headers", { status: 401 });
      }

      const event = await this.verifyWebhookSignature(
        rawBody,
        svixId,
        svixTimestamp,
        svixSignature
      );

      if (event.type !== "email.received") {
        this.logger.info("Ignoring non-email.received webhook event", {
          eventType: event.type,
        });
        return new Response("OK", { status: 200 });
      }

      const emailEvent = event as ResendEmailReceivedEvent;

      const senderEmail = normalizeEmailAddress(emailEvent.data.from);
      if (!this.isAuthorizedSender(senderEmail)) {
        this.logger.info("Email ignored - sender not authorized", {
          sender: emailEvent.data.from,
          normalizedSender: senderEmail,
        });
        return new Response("OK", { status: 200 });
      }

      const recipientEmail = normalizeEmailAddress(emailEvent.data.to[0]);
      if (!this.isMonitoredRecipient(recipientEmail)) {
        this.logger.info("Email ignored - recipient not monitored", {
          recipient: emailEvent.data.to[0],
          normalizedRecipient: recipientEmail,
        });
        return new Response("OK", { status: 200 });
      }

      const fullEmail = await this.fetchFullEmail(emailEvent.data.email_id);
      const parsedEmail = this.convertToInternalFormat(fullEmail);

      // Process email in background if context is available to prevent webhook timeouts/retries
      const processingPromise = this.emailHandler
        .processEmail(parsedEmail, ctx)
        .then(() => {
          this.logger.info("Email processing completed", {
            emailId: emailEvent.data.email_id,
            processingTime: Date.now() - startTime,
          });
        })
        .catch((error) => {
          this.logger.error("Email processing failed in background", {
            emailId: emailEvent.data.email_id,
            error: error instanceof Error ? error.message : String(error),
          });
        });

      if (ctx) {
        ctx.waitUntil(processingPromise);
        this.logger.info("Email processing offloaded to background", {
          emailId: emailEvent.data.email_id,
        });
      } else {
        await processingPromise;
      }

      this.logger.info("Webhook processed successfully", {
        emailId: emailEvent.data.email_id,
        from: emailEvent.data.from,
        to: emailEvent.data.to,
        processingTime: Date.now() - startTime,
      });

      return new Response(JSON.stringify({ received: true, emailId: fullEmail.id }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      const { message, stack } = formatError(error);
      this.logger.error("Webhook processing failed", {
        error: message,
        stack,
        processingTime: Date.now() - startTime,
      });

      return new Response(
        JSON.stringify({
          error: "Webhook processing failed",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  private verifyWebhookSignature(
    body: string,
    svixId: string,
    svixTimestamp: string,
    svixSignature: string
  ): ResendWebhookEvent {
    try {
      // Resend SDK handles signature verification via webhooks.verify
      const verified = this.resend.webhooks.verify({
        payload: body,
        headers: {
          id: svixId,
          timestamp: svixTimestamp,
          signature: svixSignature,
        },
        webhookSecret: this.webhookSecret,
      });

      return verified as ResendWebhookEvent;
    } catch (error) {
      this.logger.error("Webhook signature verification failed", formatError(error));
      throw new APIAuthError("Invalid webhook signature");
    }
  }

  private async fetchFullEmail(emailId: string): Promise<ResendFullEmail> {
    try {
      const { data, error } = await this.resend.emails.receiving.get(emailId);

      if (error) {
        const errorMessage = error.message.toLowerCase();

        if (errorMessage.includes("unauthorized") || errorMessage.includes("authentication")) {
          throw new APIAuthError(`Resend authentication failed: ${error.message}`);
        }

        if (errorMessage.includes("timeout") || errorMessage.includes("timed out")) {
          throw new APITimeoutError(`Resend fetch timed out: ${error.message}`);
        }

        throw new APIValidationError(`Failed to fetch email: ${error.message}`);
      }

      if (!data) {
        throw new APIValidationError("No email data returned from Resend API");
      }

      return data as ResendFullEmail;
    } catch (error) {
      if (isTypedAPIError(error)) throw error;

      this.logger.error("Failed to fetch full email from Resend", {
        emailId,
        ...formatError(error),
      });
      throw new APITimeoutError(
        `Unexpected error fetching email: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private convertToInternalFormat(email: ResendFullEmail): ParsedEmailData {
    // Resend provides text separately from HTML; use empty string as fallback
    const bodyText = email.text || "";

    return {
      from: email.from,
      to: email.to,
      cc: email.cc,
      subject: email.subject,
      body: bodyText,
      html: email.html || undefined,
      messageId: email.message_id,
      inReplyTo: email.headers["in-reply-to"],
      references: email.headers.references,
      date: new Date(email.created_at),
    };
  }

  private isAuthorizedSender(senderEmail: string): boolean {
    const isAuthorizedDomain = this.config.authorization.authorizedDomains.some((domain) =>
      senderEmail.endsWith(`@${domain}`)
    );
    const isAuthorizedEmail = this.config.authorization.authorizedEmails.some(
      (email) => senderEmail === normalizeEmailAddress(email)
    );

    return isAuthorizedDomain || isAuthorizedEmail;
  }

  private isMonitoredRecipient(recipientEmail: string): boolean {
    return this.config.email.monitoredAddresses.some(
      (address) => recipientEmail === normalizeEmailAddress(address)
    );
  }
}
