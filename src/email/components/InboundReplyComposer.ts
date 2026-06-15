/**
 * src/email/components/InboundReplyComposer.ts
 *
 * Raw MIME composer for Cloudflare Email Worker inbound replies.
 *
 * Top-level declarations:
 * - InboundReplyMessage: Data required to compose an inbound reply MIME message
 * - InboundReplySigningOptions: Agents SDK routing header signing inputs
 * - InboundReplyComposer: Builds signed raw MIME for AgentEmail.reply()
 */

import { signAgentHeaders } from "agents/email";
import { normalizeEmailAddress } from "../utils/EmailNormalizer";

const EMAIL_DISPLAY_NAME = "CAF-GPT";

export interface InboundReplyMessage {
  fromAddress: string;
  toAddress: string;
  subject: string;
  text: string;
  html?: string;
  threadingOptions: {
    inReplyTo?: string;
    headers?: Record<string, string>;
  };
}

export interface InboundReplySigningOptions {
  secret: string;
  agentName: string;
  agentId: string;
}

/** Builds signed raw MIME for AgentEmail.reply(). */
export class InboundReplyComposer {
  /** Builds a raw RFC 5322 reply with signed Agents SDK routing headers. */
  async composeRawReply(
    message: InboundReplyMessage,
    signing: InboundReplySigningOptions
  ): Promise<string> {
    const messageId = `<${crypto.randomUUID()}@${this.getEmailDomain(message.fromAddress)}>`;
    const signedHeaders = await signAgentHeaders(
      signing.secret,
      signing.agentName,
      signing.agentId
    );
    const headers = [
      this.formatHeader("From", this.formatMailbox(message.fromAddress, EMAIL_DISPLAY_NAME)),
      this.formatHeader("To", this.formatMailbox(message.toAddress)),
      this.formatHeader("Subject", message.subject),
      this.formatHeader("Message-ID", messageId),
      this.formatHeader("Date", new Date().toUTCString()),
      this.formatHeader("MIME-Version", "1.0"),
      ...this.formatThreadingHeaders(message.threadingOptions),
      ...Object.entries(signedHeaders).map(([name, value]) => this.formatHeader(name, value)),
    ];

    if (!message.html) {
      return [
        ...headers,
        this.formatHeader("Content-Type", "text/plain; charset=utf-8"),
        this.formatHeader("Content-Transfer-Encoding", "8bit"),
        "",
        this.normalizeMimeBody(message.text),
      ].join("\r\n");
    }

    const boundary = `caf-gpt-${crypto.randomUUID()}`;
    return [
      ...headers,
      this.formatHeader("Content-Type", `multipart/alternative; boundary="${boundary}"`),
      "",
      `--${boundary}`,
      this.formatHeader("Content-Type", "text/plain; charset=utf-8"),
      this.formatHeader("Content-Transfer-Encoding", "8bit"),
      "",
      this.normalizeMimeBody(message.text),
      `--${boundary}`,
      this.formatHeader("Content-Type", "text/html; charset=utf-8"),
      this.formatHeader("Content-Transfer-Encoding", "8bit"),
      "",
      this.normalizeMimeBody(message.html),
      `--${boundary}--`,
      "",
    ].join("\r\n");
  }

  /** Formats threading headers for the raw reply. */
  private formatThreadingHeaders(
    threadingOptions: InboundReplyMessage["threadingOptions"]
  ): string[] {
    const headers: string[] = [];

    if (threadingOptions.inReplyTo) {
      headers.push(this.formatHeader("In-Reply-To", threadingOptions.inReplyTo));
    }

    for (const [name, value] of Object.entries(threadingOptions.headers ?? {})) {
      headers.push(this.formatHeader(name, value));
    }

    return headers;
  }

  /** Formats a single MIME header while preventing header injection. */
  private formatHeader(name: string, value: string): string {
    return `${name}: ${this.sanitizeHeaderValue(value)}`;
  }

  /** Formats a mailbox header value. */
  private formatMailbox(address: string, displayName?: string): string {
    const mailbox = `<${normalizeEmailAddress(address)}>`;

    if (!displayName) {
      return mailbox;
    }

    return `"${displayName.replace(/["\\]/g, "\\$&")}" ${mailbox}`;
  }

  /** Normalizes body line endings for raw MIME output. */
  private normalizeMimeBody(content: string): string {
    return content.replace(/\r?\n/g, "\r\n");
  }

  /** Sanitizes a MIME header value. */
  private sanitizeHeaderValue(value: string): string {
    return value.replace(/[\r\n]+/g, " ").trim();
  }

  /** Extracts the domain used for generated Message-ID values. */
  private getEmailDomain(address: string): string {
    return normalizeEmailAddress(address).split("@")[1] ?? "caf-gpt.com";
  }
}
