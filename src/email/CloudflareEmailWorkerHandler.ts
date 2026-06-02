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

import PostalMime, { type Address } from "postal-mime";
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

    await this.emailHandler.processEmail(await this.parseMessage(message), ctx);
  }

  /** Converts ForwardableEmailMessage into ParsedEmailData. */
  private async parseMessage(message: ForwardableEmailMessage): Promise<ParsedEmailData> {
    const parser = new PostalMime();
    // ⚡ Bolt: Pass ReadableStream directly to PostalMime to avoid buffering the entire email into an ArrayBuffer
    // biome-ignore lint/suspicious/noExplicitAny: PostalMime types lack full ReadableStream support
    const parsed = await parser.parse(message.raw as any);

    const headers = this.buildHeaderMap(message.headers);
    const messageIdHeader = message.headers.get("message-id") ?? undefined;
    const inReplyToHeader = message.headers.get("in-reply-to") ?? undefined;
    const referencesHeader = message.headers.get("references") ?? undefined;

    const rawTextBody = parsed.text ?? "";
    const rawHtmlBody = typeof parsed.html === "string" ? parsed.html : undefined;

    const derivedBody =
      rawTextBody.trim().length > 0 ? rawTextBody : rawHtmlBody ? htmlToText(rawHtmlBody) : "";

    const toAddresses = this.mergeAddresses(this.extractAddresses(parsed.to), [
      normalizeEmailAddress(message.to),
    ]);

    return {
      from: normalizeEmailAddress(message.from),
      to: toAddresses,
      cc: this.extractAddresses(parsed.cc),
      subject: parsed.subject ?? message.headers.get("subject") ?? "",
      headers,
      body: derivedBody,
      html: rawHtmlBody,
      messageId: messageIdHeader,
      inReplyTo: inReplyToHeader,
      references: referencesHeader,
      date: new Date(),
      originalMessage: message,
    };
  }

  /** Extracts normalized mailbox addresses from parsed MIME address groups. */
  private extractAddresses(addresses?: Address[]): string[] {
    if (!addresses) {
      return [];
    }

    return this.mergeAddresses(
      addresses.flatMap((entry) => {
        if (entry.group) {
          return entry.group.map((mailbox) => normalizeEmailAddress(mailbox.address));
        }
        return [normalizeEmailAddress(entry.address)];
      })
    );
  }

  /** Merges address lists while dropping empty values and preserving order. */
  private mergeAddresses(...addressLists: string[][]): string[] {
    const addresses: string[] = [];
    const seen = new Set<string>();

    for (const address of addressLists.flat()) {
      if (!address || seen.has(address)) {
        continue;
      }
      addresses.push(address);
      seen.add(address);
    }

    return addresses;
  }

  /** Builds a normalized header map with lowercase keys. */
  private buildHeaderMap(headers: Headers): Record<string, string> {
    const normalized: Record<string, string> = {};

    headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (normalized[lowerKey]) {
        normalized[lowerKey] = `${normalized[lowerKey]}, ${value}`;
        return;
      }
      normalized[lowerKey] = value;
    });

    return normalized;
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
