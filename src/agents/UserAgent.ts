/**
 * src/agents/UserAgent.ts
 *
 * Durable Cloudflare Agents SDK email agent for per-user CAF-GPT processing
 *
 * Top-level declarations:
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
import { EmailComposer, HtmlEmailComposer } from "../email/components";
import type { ParsedEmailData } from "../email/types";
import { detectAutoReply } from "../email/utils/EmailLoopGuard";
import { normalizeEmailAddress } from "../email/utils/EmailNormalizer";
import { isValidMessageId, validateEmailContent } from "../email/utils/EmailValidator";
import { ERROR_RESPONSE_TEMPLATES } from "../email/utils/ErrorResponseTemplates";
import { htmlToText } from "../email/utils/HtmlToText";
import {
  isAuthorizedEmailAddress,
  type ResolvedReplyRecipients,
  resolveReplyRecipients,
} from "../email/utils/ReplyRecipients";
import { EmailValidationError } from "../errors";
import { getSafeErrorMetadata, Logger } from "../Logger";
import { AgentCoordinator } from "./AgentCoordinator";
import { MemoryFooAgent } from "./sub-agents";

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
  override observability = undefined;

  private readonly logger = Logger.getInstance();
  private readonly emailComposer = new EmailComposer();
  private readonly htmlEmailComposer = new HtmlEmailComposer();
  private agentCoordinator?: AgentCoordinator;

  /** Rethrows SDK errors without the default detailed console output. */
  override onError(connectionOrError: unknown, error?: unknown): never {
    throw error ?? connectionOrError;
  }

  /** Handles inbound email routed by the Agents SDK. */
  async onEmail(email: AgentEmail): Promise<void> {
    let config: AppConfig | undefined;
    let parsedEmail = this.buildEnvelopeEmailData(email);
    let sendAttempted = false;

    try {
      config = createConfig(this.env);
      parsedEmail = this.buildFallbackEmailData(email);
      const rawEmail = await email.getRaw();
      parsedEmail = await this.parseEmail(email, rawEmail);

      if (this.guardAgainstSelfLoop(parsedEmail, config)) {
        return;
      }

      const autoReplyDetection = detectAutoReply(parsedEmail);
      if (autoReplyDetection.ignore) {
        this.logger.info("Ignoring auto-reply or bounce email", {
          reasonCount: autoReplyDetection.reasons.length,
        });
        return;
      }

      this.validateEmail(parsedEmail);
      const recipients = resolveReplyRecipients(parsedEmail, config);
      const emailContext = this.buildEmailContext(parsedEmail);
      const response = await this.getAIResponse(emailContext, config);

      if (!response.shouldRespond || !response.content?.trim()) {
        this.logger.info("Inbound email completed without a reply");
        return;
      }

      await this.sendReply(parsedEmail, response.content, config, recipients, () => {
        sendAttempted = true;
      });
      await this.scheduleMemoryUpdate(emailContext, response.content);
      this.logger.info("Inbound email reply accepted", {
        toCount: recipients.to.length,
        ccCount: recipients.cc.length,
      });
    } catch (error) {
      this.logger.error("Email processing failed", getSafeErrorMetadata(error));
      if (sendAttempted || !config) {
        return;
      }

      await this.handleProcessingError(error, parsedEmail, config);
    }
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
      this.logger.error("Memory update failed", getSafeErrorMetadata(error));
      throw new Error("Scheduled memory update failed");
    }
  }

  /** Parses an AgentEmail into CAF-GPT's internal ParsedEmailData shape. */
  private async parseEmail(email: AgentEmail, rawEmail: Uint8Array): Promise<ParsedEmailData> {
    const parser = new PostalMime();
    const parsed = await parser.parse(rawEmail);
    const headers = this.buildHeaderMap(email.headers);
    const rawTextBody = parsed.text ?? "";
    const rawHtmlBody = typeof parsed.html === "string" ? parsed.html : undefined;
    const derivedBody =
      rawTextBody.trim().length > 0 ? rawTextBody : rawHtmlBody ? htmlToText(rawHtmlBody) : "";
    const fromAddresses = this.extractAddresses(parsed.from ? [parsed.from] : undefined);

    return {
      envelopeFrom: normalizeEmailAddress(email.from),
      envelopeTo: normalizeEmailAddress(email.to),
      from: fromAddresses.length === 1 ? fromAddresses[0] : "",
      replyTo: this.extractAddresses(parsed.replyTo),
      replyToPresent: headers["reply-to"] !== undefined,
      to: this.extractAddresses(parsed.to),
      cc: this.extractAddresses(parsed.cc),
      subject: parsed.subject ?? email.headers.get("subject") ?? "",
      headers,
      body: derivedBody,
      html: rawHtmlBody,
      messageId: parsed.messageId ?? email.headers.get("message-id") ?? undefined,
      inReplyTo: parsed.inReplyTo ?? email.headers.get("in-reply-to") ?? undefined,
      references: parsed.references ?? email.headers.get("references") ?? undefined,
      date: parsed.date ? new Date(parsed.date) : new Date(),
    };
  }

  /** Checks if email is from CAF-GPT itself to prevent loops. */
  private guardAgainstSelfLoop(parsedEmail: ParsedEmailData, config: AppConfig): boolean {
    if (!parsedEmail.envelopeFrom) {
      this.logger.warn("Email sender is missing, ignoring email");
      return true;
    }

    const normalizedFrom = normalizeEmailAddress(parsedEmail.envelopeFrom);
    const selfAddresses = new Set(
      [config.email.agentFromEmail, ...config.email.monitoredAddresses].map((address) =>
        normalizeEmailAddress(address)
      )
    );

    if (selfAddresses.has(normalizedFrom)) {
      this.logger.info("Ignoring email from self");
      return true;
    }
    return false;
  }

  /** Validates inbound content before recipient policy handles reply-all candidates. */
  private validateEmail(parsedEmail: ParsedEmailData): void {
    const contentValidation = validateEmailContent(parsedEmail);
    if (!contentValidation.isValid) {
      this.logger.error("Email content validation failed", {
        errorCount: contentValidation.errors.length,
      });
      throw new EmailValidationError("Inbound email content failed validation");
    }

    if (contentValidation.warnings.length > 0) {
      this.logger.warn("Email content warnings", {
        warningCount: contentValidation.warnings.length,
      });
    }
  }

  /** Builds full email context string for AI processing. */
  private buildEmailContext(parsedEmail: ParsedEmailData): string {
    return `Subject: ${parsedEmail.subject}
Authenticated-Sender: ${parsedEmail.envelopeFrom}
RFC-From: ${parsedEmail.from}
Envelope-To: ${parsedEmail.envelopeTo}
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
      this.agentCoordinator = await AgentCoordinator.create(this.env, config);
    }
    return await this.agentCoordinator.processWithPrimeFoo(emailContext, this.state.memory);
  }

  /** Sends a normal reply through the Agents SDK and Email Service binding. */
  private async sendReply(
    parsedEmail: ParsedEmailData,
    content: string,
    config: AppConfig,
    recipients: ResolvedReplyRecipients,
    markSendAttempted: () => void
  ): Promise<void> {
    const quotedContent = this.emailComposer.formatQuotedContent(parsedEmail);
    const replyText = htmlToText(content);
    const fullTextContent = (replyText || content.trim()) + quotedContent;
    const htmlContent = this.htmlEmailComposer.composeHtmlReply(parsedEmail, content.trim());
    const subject = /^re:/i.test(parsedEmail.subject)
      ? parsedEmail.subject
      : `Re: ${parsedEmail.subject}`;
    const threadingOptions = this.buildThreadingOptions(parsedEmail);
    const replyFromAddress = this.resolveReplyFromAddress(parsedEmail, config);

    markSendAttempted();
    await this.sendEmail({
      binding: this.env.EMAIL,
      to: recipients.to,
      ...(recipients.cc.length > 0 ? { cc: recipients.cc } : {}),
      from: { email: replyFromAddress, name: "CAF-GPT" },
      replyTo: replyFromAddress,
      subject,
      text: fullTextContent,
      html: htmlContent,
      inReplyTo: threadingOptions.inReplyTo,
      headers: threadingOptions.headers,
    });
  }

  /** Schedules a durable memory update after the user-visible reply succeeds. */
  private async scheduleMemoryUpdate(emailContext: string, agentReply: string): Promise<void> {
    try {
      await this.schedule<MemoryUpdateTask>(
        1,
        "runMemoryUpdate",
        { emailContext, agentReply },
        { retry: { maxAttempts: 3 }, idempotent: true }
      );
    } catch (error) {
      this.logger.error("Failed to schedule memory update", getSafeErrorMetadata(error));
    }
  }

  /** Attempts one sender-only structured error reply and swallows every reply failure. */
  private async handleProcessingError(
    error: unknown,
    parsedEmail: ParsedEmailData,
    config: AppConfig
  ): Promise<void> {
    const envelopeSender = normalizeEmailAddress(parsedEmail.envelopeFrom);
    if (!isAuthorizedEmailAddress(envelopeSender, config.authorization)) {
      this.logger.warn("Skipping error reply to unauthorized or malformed envelope sender");
      return;
    }

    try {
      const threadingOptions = this.buildThreadingOptions(parsedEmail);
      const replyFromAddress = this.resolveReplyFromAddress(parsedEmail, config);
      await this.sendEmail({
        binding: this.env.EMAIL,
        to: envelopeSender,
        from: { email: replyFromAddress, name: "CAF-GPT" },
        replyTo: replyFromAddress,
        subject: "Error Processing Email",
        text: this.getErrorResponseMessage(error),
        inReplyTo: threadingOptions.inReplyTo,
        headers: threadingOptions.headers,
      });
      this.logger.info("Sender-only error reply sent");
    } catch (replyError) {
      this.logger.error("Failed to send error reply", getSafeErrorMetadata(replyError));
    }
  }

  /** Gets a user-friendly error response message. */
  private getErrorResponseMessage(error: unknown): string {
    const template =
      ERROR_RESPONSE_TEMPLATES.find((entry) => entry.match(error)) ??
      ERROR_RESPONSE_TEMPLATES[ERROR_RESPONSE_TEMPLATES.length - 1];
    return template.lines.join("\n");
  }

  /** Resolves the sender identity for replies from the inbound monitored recipient. */
  private resolveReplyFromAddress(parsedEmail: ParsedEmailData, config: AppConfig): string {
    const monitoredAddresses = new Set(
      config.email.monitoredAddresses.map((address) => normalizeEmailAddress(address))
    );
    const inboundRecipient = normalizeEmailAddress(parsedEmail.envelopeTo);

    return monitoredAddresses.has(inboundRecipient)
      ? inboundRecipient
      : normalizeEmailAddress(config.email.agentFromEmail);
  }

  /** Builds valid threading headers for an email reply. */
  private buildThreadingOptions(parsedEmail: ParsedEmailData): {
    inReplyTo?: string;
    headers?: Record<string, string>;
  } {
    if (!parsedEmail.messageId || !isValidMessageId(parsedEmail.messageId)) {
      return {};
    }

    const references = this.buildReferencesHeader(parsedEmail);
    return {
      inReplyTo: parsedEmail.messageId,
      ...(references ? { headers: { References: references } } : {}),
    };
  }

  /** Builds the reply References chain from prior threading headers plus the original Message-ID. */
  private buildReferencesHeader(parsedEmail: ParsedEmailData): string {
    const messageId = parsedEmail.messageId;
    if (!messageId || !isValidMessageId(messageId)) {
      return "";
    }

    const inboundReferences = (parsedEmail.references ?? "").trim();
    const priorMessageIds = inboundReferences
      ? inboundReferences.split(/\s+/).filter((reference) => isValidMessageId(reference))
      : parsedEmail.inReplyTo && isValidMessageId(parsedEmail.inReplyTo)
        ? [parsedEmail.inReplyTo]
        : [];
    const chain = [
      ...new Set(priorMessageIds.filter((priorMessageId) => priorMessageId !== messageId)),
      messageId,
    ].join(" ");
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

    return addresses.flatMap((entry) => {
      if (entry.group) {
        return entry.group.map((mailbox) => normalizeEmailAddress(mailbox.address));
      }
      return [normalizeEmailAddress(entry.address)];
    });
  }

  /** Builds minimal envelope-only metadata before untrusted MIME parsing. */
  private buildEnvelopeEmailData(email: AgentEmail): ParsedEmailData {
    return {
      envelopeFrom: normalizeEmailAddress(email.from),
      envelopeTo: normalizeEmailAddress(email.to),
      from: normalizeEmailAddress(email.from),
      replyTo: [],
      replyToPresent: false,
      to: [normalizeEmailAddress(email.to)].filter(Boolean),
      cc: [],
      subject: "",
      body: "",
      date: new Date(),
    };
  }

  /** Adds available envelope headers to fallback metadata before raw MIME parsing. */
  private buildFallbackEmailData(email: AgentEmail): ParsedEmailData {
    const headers = this.buildHeaderMap(email.headers);
    return {
      ...this.buildEnvelopeEmailData(email),
      headers,
      messageId: headers["message-id"],
      inReplyTo: headers["in-reply-to"],
      references: headers.references,
    };
  }

  /** Builds a normalized header map with lowercase keys. */
  private buildHeaderMap(headers: Headers): Record<string, string> {
    const normalized: Record<string, string> = {};

    headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      normalized[lowerKey] = normalized[lowerKey] ? `${normalized[lowerKey]}, ${value}` : value;
    });

    return normalized;
  }
}
