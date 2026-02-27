/**
 * src/email/CloudflareEmailWorkerHandler.ts
 *
 * Handles Cloudflare Email Worker events and routes authorized emails to SimpleEmailHandler
 *
 * Top-level declarations:
 * - CloudflareEmailWorkerHandler: Parses inbound EmailMessage, validates sender/recipient, and triggers processing
 * - parseMessage: Converts ForwardableEmailMessage into ParsedEmailData
 * - isAuthorizedSender: Checks configured sender allow list
 * - isMonitoredRecipient: Checks monitored recipient addresses
 */

import PostalMime from "postal-mime";
import type { AppConfig } from "../config";
import { Logger } from "../Logger";
import { SimpleEmailHandler } from "./SimpleEmailHandler";
import type { ParsedEmailData } from "./types";
import { normalizeEmailAddress } from "./utils/EmailNormalizer";
import { htmlToText } from "./utils/HtmlToText";

/** Parses inbound EmailMessage, validates sender/recipient, and triggers processing. */
export class CloudflareEmailWorkerHandler {
  private readonly logger: Logger;
  private readonly emailHandler: SimpleEmailHandler;

  constructor(
    env: Env,
    private readonly config: AppConfig,
    emailHandler?: SimpleEmailHandler
  ) {
    this.logger = Logger.getInstance();
    this.emailHandler = emailHandler ?? new SimpleEmailHandler(env, config);
  }

  async handleEmail(message: ForwardableEmailMessage, ctx: ExecutionContext): Promise<void> {
    const senderEmail = normalizeEmailAddress(message.from);
    if (!this.isAuthorizedSender(senderEmail)) {
      this.logger.info("Email ignored - sender not authorized", {
        sender: message.from,
        normalizedSender: senderEmail,
      });
      return;
    }

    const recipientEmail = normalizeEmailAddress(message.to);
    if (!this.isMonitoredRecipient(recipientEmail)) {
      this.logger.info("Email ignored - recipient not monitored", {
        recipient: message.to,
        normalizedRecipient: recipientEmail,
      });
      return;
    }

    const parsedEmail = await this.parseMessage(message);
    parsedEmail.to = [this.config.email.agentFromEmail];

    await this.emailHandler.processEmail(parsedEmail, ctx);
  }

  /** Converts ForwardableEmailMessage into ParsedEmailData. */
  private async parseMessage(message: ForwardableEmailMessage): Promise<ParsedEmailData> {
    const rawEmail = await new Response(message.raw).arrayBuffer();
    const parser = new PostalMime();
    const parsed = await parser.parse(rawEmail);

    const messageIdHeader = message.headers.get("message-id") ?? undefined;
    const inReplyToHeader = message.headers.get("in-reply-to") ?? undefined;
    const referencesHeader = message.headers.get("references") ?? undefined;

    const rawTextBody = parsed.text ?? "";
    const rawHtmlBody = typeof parsed.html === "string" ? parsed.html : undefined;

    const derivedBody =
      rawTextBody.trim().length > 0 ? rawTextBody : rawHtmlBody ? htmlToText(rawHtmlBody) : "";

    return {
      from: normalizeEmailAddress(message.from),
      to: [normalizeEmailAddress(message.to)],
      cc: [],
      subject: parsed.subject ?? message.headers.get("subject") ?? "",
      body: derivedBody,
      html: rawHtmlBody,
      messageId: messageIdHeader,
      inReplyTo: inReplyToHeader,
      references: referencesHeader,
      date: new Date(),
      originalMessage: message,
    };
  }

  /** Checks configured sender allow list. */
  private isAuthorizedSender(senderEmail: string): boolean {
    const isAuthorizedDomain = this.config.authorization.authorizedDomains.some((domain) =>
      senderEmail.endsWith(`@${domain}`)
    );
    const isAuthorizedEmail = this.config.authorization.authorizedEmails.some(
      (email) => senderEmail === normalizeEmailAddress(email)
    );

    return isAuthorizedDomain || isAuthorizedEmail;
  }

  /** Checks monitored recipient addresses. */
  private isMonitoredRecipient(recipientEmail: string): boolean {
    return this.config.email.monitoredAddresses.some(
      (address) => recipientEmail === normalizeEmailAddress(address)
    );
  }
}
