/**
 * src/agents/UserAgent.ts
 *
 * Durable Cloudflare Agents SDK email agent for per-user CAF-GPT processing
 *
 * Top-level declarations:
 * - AGENT_EMAIL_ROUTING_NAME: Agents SDK routing name used in signed reply headers
 * - UserAgentState: Persistent per-user state stored by the Agents runtime
 * - MemoryUpdateTask: Scheduled memory update payload
 * - UserAgent: Durable Object-backed email agent with AI response and memory scheduling
 * - getUserAgentId: Converts a normalized sender email into a stable Agent instance id
 */

import { Agent } from "agents";
import type { AgentEmail } from "agents/email";
import PostalMime, { type Address } from "postal-mime";
import type { AppConfig } from "../config";
import { createConfig } from "../config";
import {
  EmailComposer,
  HtmlEmailComposer,
  InboundReplyComposer,
  type InboundReplyMessage,
} from "../email/components";
import type { ParsedEmailData } from "../email/types";
import { detectAutoReply } from "../email/utils/EmailLoopGuard";
import { normalizeEmailAddress } from "../email/utils/EmailNormalizer";
import {
  isValidMessageId,
  validateEmailContent,
  validateRecipients,
} from "../email/utils/EmailValidator";
import { ERROR_RESPONSE_TEMPLATES } from "../email/utils/ErrorResponseTemplates";
import { htmlToText } from "../email/utils/HtmlToText";
import { BaseAppError, EmailCompositionError, EmailValidationError } from "../errors";
import { formatError, Logger } from "../Logger";
import { AgentCoordinator } from "./AgentCoordinator";
import { MemoryFooAgent } from "./sub-agents";

const AGENT_EMAIL_ROUTING_NAME = "user-agent";
const MEMORY_MAX_CONTENT_LENGTH = 4000;
const REFERENCES_MAX_LENGTH = 1000;

export interface UserAgentState {
  memory: string;
}

interface MemoryUpdateTask {
  emailContext: string;
  agentReply: string;
}

/** Converts a normalized sender email into a stable Agent instance id. */
export function getUserAgentId(senderEmail: string): string {
  return encodeURIComponent(normalizeEmailAddress(senderEmail));
}

/** Durable Object-backed email agent with AI response and memory scheduling. */
export class UserAgent extends Agent<Env, UserAgentState> {
  initialState: UserAgentState = { memory: "" };

  private readonly logger = Logger.getInstance();
  private readonly emailComposer = new EmailComposer();
  private readonly htmlEmailComposer = new HtmlEmailComposer();
  private readonly inboundReplyComposer = new InboundReplyComposer();
  private agentCoordinator?: AgentCoordinator;

  /** Handles inbound email routed by the Agents SDK. */
  async onEmail(email: AgentEmail): Promise<void> {
    const config = createConfig(this.env);
    const parsedEmail = await this.parseEmail(email);
    await this.processEmail(email, parsedEmail, config);
  }

  /** Runs a durable scheduled memory update after a successful email reply. */
  async runMemoryUpdate(task: MemoryUpdateTask): Promise<void> {
    try {
      const memoryAgent = new MemoryFooAgent(this.env, createConfig(this.env));
      const result = await memoryAgent.updateMemory(
        this.state.memory,
        task.emailContext,
        task.agentReply
      );

      if (!result.updated || !result.content) {
        this.logger.info("User memory unchanged");
        return;
      }

      const memory =
        result.content.length > MEMORY_MAX_CONTENT_LENGTH
          ? result.content.substring(0, MEMORY_MAX_CONTENT_LENGTH)
          : result.content;

      this.setState({ ...this.state, memory });
      this.logger.info("User memory updated successfully", {
        contentLength: memory.length,
      });
    } catch (error) {
      this.logger.error("Memory update failed", formatError(error));
      throw error;
    }
  }

  /** Parses an AgentEmail into CAF-GPT's internal ParsedEmailData shape. */
  private async parseEmail(email: AgentEmail): Promise<ParsedEmailData> {
    const parser = new PostalMime();
    const parsed = await parser.parse(await email.getRaw());
    const headers = this.buildHeaderMap(email.headers);
    const rawTextBody = parsed.text ?? "";
    const rawHtmlBody = typeof parsed.html === "string" ? parsed.html : undefined;
    const derivedBody =
      rawTextBody.trim().length > 0 ? rawTextBody : rawHtmlBody ? htmlToText(rawHtmlBody) : "";
    const toAddresses = this.mergeAddresses(
      [normalizeEmailAddress(email.to)],
      this.extractAddresses(parsed.to)
    );

    return {
      from: normalizeEmailAddress(email.from),
      to: toAddresses,
      cc: this.extractAddresses(parsed.cc),
      subject: parsed.subject ?? email.headers.get("subject") ?? "",
      headers,
      body: derivedBody,
      html: rawHtmlBody,
      messageId: email.headers.get("message-id") ?? undefined,
      inReplyTo: email.headers.get("in-reply-to") ?? undefined,
      references: email.headers.get("references") ?? undefined,
      date: new Date(),
    };
  }

  /** Processes a parsed email through validation, Prime Foo, reply, and memory scheduling. */
  private async processEmail(
    originalEmail: AgentEmail,
    parsedEmail: ParsedEmailData,
    config: AppConfig
  ): Promise<void> {
    try {
      this.logger.info("Processing email from sender", { from: parsedEmail.from });

      if (this.guardAgainstSelfLoop(parsedEmail, config)) {
        return;
      }

      const autoReplyDetection = detectAutoReply(parsedEmail);
      if (autoReplyDetection.ignore) {
        this.logger.info("Ignoring auto-reply or bounce email", {
          from: parsedEmail.from,
          subject: parsedEmail.subject,
          reasons: autoReplyDetection.reasons,
        });
        return;
      }

      this.validateEmail(parsedEmail);

      const emailContext = this.buildEmailContext(parsedEmail);
      const response = await this.getAIResponse(emailContext, config);

      if (response.shouldRespond && response.content?.trim()) {
        await this.sendReply(originalEmail, parsedEmail, response.content, config);
        await this.scheduleMemoryUpdate(emailContext, response.content);
      }
    } catch (error) {
      this.logProcessingFailure(error, parsedEmail);
      await this.handleProcessingError(originalEmail, error, parsedEmail, config);

      if (this.shouldRethrowProcessingError(error)) {
        throw error;
      }
    }
  }

  /** Logs processing failures with consistent context. */
  private logProcessingFailure(error: unknown, parsedEmail: ParsedEmailData): void {
    if (error instanceof BaseAppError) {
      this.logger.error("Email processing failed", {
        from: parsedEmail.from,
        code: error.code,
        recoverable: error.recoverable,
        ...formatError(error),
      });
      return;
    }

    this.logger.error("Email processing failed", {
      from: parsedEmail.from,
      ...formatError(error),
    });
  }

  /** Determines whether an error should escape the email handler. */
  private shouldRethrowProcessingError(error: unknown): boolean {
    if (error instanceof BaseAppError) {
      return !error.recoverable;
    }
    return true;
  }

  /** Checks if email is from CAF-GPT itself to prevent loops. */
  private guardAgainstSelfLoop(parsedEmail: ParsedEmailData, config: AppConfig): boolean {
    if (!parsedEmail.from) {
      this.logger.warn("Email sender is missing, ignoring email to prevent processing errors");
      return true;
    }

    const normalizedFrom = normalizeEmailAddress(parsedEmail.from);
    const selfAddresses = new Set(
      [config.email.agentFromEmail, ...config.email.monitoredAddresses].map((address) =>
        normalizeEmailAddress(address)
      )
    );

    if (selfAddresses.has(normalizedFrom)) {
      this.logger.info("Ignoring email from self", { from: parsedEmail.from });
      return true;
    }
    return false;
  }

  /** Validates email content and recipients. */
  private validateEmail(parsedEmail: ParsedEmailData): void {
    const contentValidation = validateEmailContent(parsedEmail);
    if (!contentValidation.isValid) {
      this.logger.error("Email content validation failed", {
        errors: contentValidation.errors.join(", "),
        from: parsedEmail.from,
      });
      throw new EmailValidationError(
        `Email content validation failed: ${contentValidation.errors.join(", ")}`
      );
    }

    if (contentValidation.warnings.length > 0) {
      this.logger.warn("Email content warnings", {
        warnings: contentValidation.warnings.join(", "),
      });
    }

    const recipientValidation = validateRecipients(parsedEmail.to, parsedEmail.cc);
    if (!recipientValidation.isValid) {
      this.logger.error("Recipient validation failed", {
        errors: recipientValidation.errors.join(", "),
        from: parsedEmail.from,
      });
      throw new EmailValidationError(
        `Recipient validation failed: ${recipientValidation.errors.join(", ")}`
      );
    }

    if (recipientValidation.warnings.length > 0) {
      this.logger.warn("Recipient warnings", {
        warnings: recipientValidation.warnings.join(", "),
      });
    }
  }

  /** Builds full email context string for AI processing. */
  private buildEmailContext(parsedEmail: ParsedEmailData): string {
    return `Subject: ${parsedEmail.subject}
From: ${parsedEmail.from}
To: ${parsedEmail.to.join(", ")}${
      parsedEmail.cc && parsedEmail.cc.length > 0 ? `\nCC: ${parsedEmail.cc.join(", ")}` : ""
    }

${parsedEmail.body}`;
  }

  /** Gets the Prime Foo response using the current Agent state memory. */
  private async getAIResponse(
    emailContext: string,
    config: AppConfig
  ): Promise<{ shouldRespond: boolean; content?: string }> {
    if (!this.agentCoordinator) {
      this.logger.info("Creating new AgentCoordinator instance");
      this.agentCoordinator = await AgentCoordinator.create(this.env, config);
    }
    return await this.agentCoordinator.processWithPrimeFoo(emailContext, this.state.memory);
  }

  /** Sends a normal signed reply through the inbound Email Worker reply envelope. */
  private async sendReply(
    originalEmail: AgentEmail,
    parsedEmail: ParsedEmailData,
    content: string,
    config: AppConfig
  ): Promise<void> {
    try {
      let quotedContent: string;
      try {
        quotedContent = this.emailComposer.formatQuotedContent(parsedEmail);
      } catch (error) {
        this.logger.warn("Quoted content formatting failed, using fallback", {
          from: parsedEmail.from,
          ...formatError(error),
        });
        quotedContent = `\n\nOn ${new Date().toUTCString()}, ${
          parsedEmail.from
        } wrote:\n> [Original message could not be quoted]`;
      }

      const replyRecipient = normalizeEmailAddress(parsedEmail.from);
      const replyText = htmlToText(content);
      const fullTextContent = (replyText ? replyText : content.trim()) + quotedContent;
      const htmlContent = this.htmlEmailComposer.composeHtmlReply(parsedEmail, content.trim());
      const subject = parsedEmail.subject.startsWith("Re:")
        ? parsedEmail.subject
        : `Re: ${parsedEmail.subject}`;
      const threadingOptions = this.buildThreadingOptions(parsedEmail);
      const replyFromAddress = this.resolveReplyFromAddress(parsedEmail, config);

      await this.replyToInboundEmail(originalEmail, {
        fromAddress: replyFromAddress,
        toAddress: replyRecipient,
        subject,
        text: fullTextContent,
        html: htmlContent,
        threadingOptions,
      });

      this.logger.info("Reply sent successfully via Email Worker reply API", {
        to: parsedEmail.from,
        from: replyFromAddress,
      });
    } catch (error) {
      this.logger.error("Failed to send reply via Email Worker reply API", {
        to: parsedEmail.from,
        ...formatError(error),
      });
      throw new EmailCompositionError(
        `Reply sending failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /** Schedules a durable memory update after the user-visible reply succeeds. */
  private async scheduleMemoryUpdate(emailContext: string, agentReply: string): Promise<void> {
    try {
      await this.schedule<MemoryUpdateTask>(
        1,
        "runMemoryUpdate",
        { emailContext, agentReply },
        { retry: { maxAttempts: 3 }, idempotent: false }
      );
    } catch (error) {
      this.logger.error("Failed to schedule memory update", formatError(error));
    }
  }

  /** Handles processing errors by sending a standardized error response when appropriate. */
  private async handleProcessingError(
    originalEmail: AgentEmail,
    error: unknown,
    parsedEmail: ParsedEmailData,
    config: AppConfig
  ): Promise<void> {
    if (error instanceof BaseAppError && !error.recoverable) {
      this.logger.info(`${error.constructor.name} is not recoverable, skipping error response`);
      return;
    }

    if (!this.shouldSendErrorResponse(error)) {
      return;
    }

    try {
      await this.sendErrorResponse(originalEmail, error, parsedEmail, config);
    } catch (replyError) {
      this.logger.error("Failed to send error reply", {
        error: replyError instanceof Error ? replyError.message : String(replyError),
        from: parsedEmail.from,
      });
    }
  }

  /** Determines if an error response should be sent. */
  private shouldSendErrorResponse(error: unknown): boolean {
    if (error instanceof BaseAppError && !error.recoverable) {
      return false;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const skipConditions = ["already been replied to", "rcpt to is different"];

    return !skipConditions.some((condition) => errorMessage.includes(condition));
  }

  /** Sends a signed sender-only error response through the inbound Email Worker reply envelope. */
  private async sendErrorResponse(
    originalEmail: AgentEmail,
    error: unknown,
    parsedEmail: ParsedEmailData,
    config: AppConfig
  ): Promise<void> {
    try {
      if (!parsedEmail.messageId) {
        this.logger.warn("Skipping error response because In-Reply-To is missing", {
          from: parsedEmail.from,
        });
        return;
      }

      const errorMessage = this.getErrorResponseMessage(error);
      const subject = parsedEmail.subject.startsWith("Re:")
        ? `Error Processing Email: ${parsedEmail.subject.slice(3).trim()}`
        : "Error Processing Email";
      const threadingOptions = this.buildThreadingOptions(parsedEmail);
      const replyFromAddress = this.resolveReplyFromAddress(parsedEmail, config);

      await this.replyToInboundEmail(originalEmail, {
        fromAddress: replyFromAddress,
        toAddress: normalizeEmailAddress(parsedEmail.from),
        subject,
        text: errorMessage,
        threadingOptions,
      });

      this.logger.info("Error reply sent successfully via Email Worker reply API", {
        to: parsedEmail.from,
        from: replyFromAddress,
      });
    } catch (replyError) {
      this.logger.error("Failed to send error reply via Email Worker reply API", {
        error: replyError instanceof Error ? replyError.message : String(replyError),
        from: parsedEmail.from,
      });
      throw new EmailCompositionError(
        `Error response sending failed: ${
          replyError instanceof Error ? replyError.message : String(replyError)
        }`
      );
    }
  }

  /** Gets a user-friendly error response message. */
  private getErrorResponseMessage(error: unknown): string {
    const template =
      ERROR_RESPONSE_TEMPLATES.find((entry) => entry.match(error)) ??
      ERROR_RESPONSE_TEMPLATES[ERROR_RESPONSE_TEMPLATES.length - 1];
    return template.lines.join("\n");
  }

  /** Sends a raw MIME reply using the original inbound Email Worker message. */
  private async replyToInboundEmail(
    originalEmail: AgentEmail,
    message: InboundReplyMessage
  ): Promise<void> {
    const raw = await this.inboundReplyComposer.composeRawReply(message, {
      secret: this.env.EMAIL_SECRET,
      agentName: AGENT_EMAIL_ROUTING_NAME,
      agentId: this.name,
    });
    await originalEmail.reply({
      from: message.fromAddress,
      to: message.toAddress,
      raw,
    });
  }

  /** Resolves the sender identity for replies from the inbound monitored recipient. */
  private resolveReplyFromAddress(parsedEmail: ParsedEmailData, config: AppConfig): string {
    const monitoredAddresses = new Set(
      config.email.monitoredAddresses.map((address) => normalizeEmailAddress(address))
    );
    const inboundRecipient = parsedEmail.to
      .map((address) => normalizeEmailAddress(address))
      .find((address) => monitoredAddresses.has(address));

    return inboundRecipient ?? normalizeEmailAddress(config.email.agentFromEmail);
  }

  /** Builds threading options for reply MIME headers. */
  private buildThreadingOptions(parsedEmail: ParsedEmailData): {
    inReplyTo?: string;
    headers?: Record<string, string>;
  } {
    if (!parsedEmail.messageId) {
      return {};
    }

    const references = this.buildReferencesHeader(parsedEmail);
    return {
      inReplyTo: parsedEmail.messageId,
      ...(references ? { headers: { References: references } } : {}),
    };
  }

  /** Builds the reply References chain from prior References plus the original Message-ID. */
  private buildReferencesHeader(parsedEmail: ParsedEmailData): string {
    const messageId = parsedEmail.messageId;
    if (!messageId) {
      return "";
    }

    const references = parsedEmail.references?.trim();
    const chain = references ? `${references} ${messageId}` : messageId;
    return this.trimReferences(chain, REFERENCES_MAX_LENGTH);
  }

  /** Trims long References chains while keeping the most recent valid message IDs. */
  private trimReferences(references: string, maxLength: number): string {
    const trimmedReferences = references.trim();

    if (trimmedReferences.length <= maxLength) {
      return trimmedReferences;
    }

    const messageIds = trimmedReferences
      .split(/\s+/)
      .filter((messageId) => messageId.length > 0 && isValidMessageId(messageId));
    const kept: string[] = [];
    let currentLength = 0;

    for (let index = messageIds.length - 1; index >= 0; index--) {
      const messageId = messageIds[index];
      const neededLength = currentLength + (kept.length > 0 ? 1 : 0) + messageId.length;

      if (neededLength > maxLength) {
        break;
      }

      kept.unshift(messageId);
      currentLength = neededLength;
    }

    return kept.join(" ");
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
}
