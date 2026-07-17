/**
 * src/agents/UserAgent.ts
 *
 * Durable Cloudflare Agents SDK email agent for per-user CAF-GPT processing
 *
 * Top-level declarations:
 * - AGENT_EMAIL_ROUTING_NAME: Agents SDK routing name used in signed reply headers
 * - UserAgentState: Persistent per-user state stored by the Agents runtime
 * - MemoryUpdateTask: Scheduled memory update payload
 * - DeliveryLedgerStatus: Durable at-most-once delivery states
 * - EmailProcessingStage: Safe processing-stage labels used in structured logs
 * - UserAgent: Durable Object-backed email agent with AI response and memory scheduling
 * - getUserAgentId: Converts a normalized sender email into a stable Agent instance id
 */

import { Agent } from "agents";
import { type AgentEmail, signAgentHeaders } from "agents/email";
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
import { isValidMessageId, validateEmailContent } from "../email/utils/EmailValidator";
import { ERROR_RESPONSE_TEMPLATES } from "../email/utils/ErrorResponseTemplates";
import { htmlToText } from "../email/utils/HtmlToText";
import {
  isAuthorizedEmailAddress,
  type ResolvedReplyRecipients,
  resolveReplyRecipients,
} from "../email/utils/ReplyRecipients";
import { AmbiguousEmailDeliveryError, EmailValidationError } from "../errors";
import { getSafeErrorMetadata, Logger } from "../Logger";
import { AgentCoordinator } from "./AgentCoordinator";
import { MemoryFooAgent } from "./sub-agents";

const AGENT_EMAIL_ROUTING_NAME = "user-agent";
const MEMORY_MAX_CONTENT_LENGTH = 4000;
const REFERENCES_MAX_LENGTH = 1000;
const DELIVERY_LEDGER_MAX_ENTRIES = 128;
const DELIVERY_LEDGER_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface UserAgentState {
  memory: string;
}

interface MemoryUpdateTask {
  emailContext: string;
  agentReply: string;
  deliveryFingerprint: string;
}

type DeliveryLedgerStatus =
  | "processing"
  | "no_response"
  | "send_started"
  | "sent"
  | "send_unknown"
  | "error_reply_started"
  | "error_replied"
  | "error_reply_unknown";

type EmailProcessingStage =
  | "configuration"
  | "raw-read"
  | "deduplication"
  | "parsing"
  | "suppression"
  | "validation"
  | "recipient-resolution"
  | "ai"
  | "successful-send"
  | "memory-schedule";

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
  private deliveryLedgerReady = false;

  /** Handles inbound email routed by the Agents SDK. */
  async onEmail(email: AgentEmail): Promise<void> {
    const startedAt = Date.now();
    const correlationId = crypto.randomUUID();
    let stage: EmailProcessingStage = "configuration";
    let config: AppConfig | undefined;
    let parsedEmail = this.buildEnvelopeEmailData(email);
    let deliveryFingerprint: string | undefined;

    try {
      config = createConfig(this.env);
      parsedEmail = this.buildFallbackEmailData(email);

      stage = "raw-read";
      let rawEmail: Uint8Array;
      try {
        rawEmail = await email.getRaw();
        deliveryFingerprint = await this.createRawDeliveryFingerprint(email, rawEmail);
      } catch (error) {
        deliveryFingerprint = await this.createFallbackDeliveryFingerprint(email);
        stage = "deduplication";
        if (!this.reserveDelivery(deliveryFingerprint)) {
          this.logDuplicateDelivery(parsedEmail, correlationId, stage);
          return;
        }
        throw error;
      }

      stage = "deduplication";
      if (!this.reserveDelivery(deliveryFingerprint)) {
        this.logDuplicateDelivery(parsedEmail, correlationId, stage);
        return;
      }

      stage = "parsing";
      parsedEmail = await this.parseEmail(email, rawEmail);

      stage = "suppression";
      if (this.guardAgainstSelfLoop(parsedEmail, config)) {
        this.transitionDelivery(deliveryFingerprint, "processing", "no_response");
        return;
      }

      const autoReplyDetection = detectAutoReply(parsedEmail);
      if (autoReplyDetection.ignore) {
        this.logger.info("Ignoring auto-reply or bounce email", {
          correlationId,
          stage,
          senderDomain: this.getEmailDomain(parsedEmail.envelopeFrom),
          receivingDomain: this.getEmailDomain(parsedEmail.envelopeTo),
          reasonCount: autoReplyDetection.reasons.length,
          elapsedMs: Date.now() - startedAt,
        });
        this.transitionDelivery(deliveryFingerprint, "processing", "no_response");
        return;
      }

      stage = "validation";
      this.validateEmail(parsedEmail);

      stage = "recipient-resolution";
      const recipients = resolveReplyRecipients(parsedEmail, config);
      this.logger.info("Successful reply recipients resolved", {
        correlationId,
        stage,
        senderDomain: this.getEmailDomain(parsedEmail.envelopeFrom),
        receivingDomain: this.getEmailDomain(parsedEmail.envelopeTo),
        primaryRecipientSource: recipients.primarySource,
        toCount: 1,
        ccCount: recipients.cc.length,
        filteredCounts: recipients.filteringSummary,
      });

      const emailContext = this.buildEmailContext(parsedEmail);
      stage = "ai";
      const response = await this.getAIResponse(emailContext, config);

      if (response.shouldRespond && response.content?.trim()) {
        stage = "successful-send";
        await this.sendReply(
          parsedEmail,
          response.content,
          config,
          recipients,
          deliveryFingerprint,
          correlationId
        );
        stage = "memory-schedule";
        await this.scheduleMemoryUpdate(emailContext, response.content, deliveryFingerprint);
      } else {
        this.transitionDelivery(deliveryFingerprint, "processing", "no_response");
      }

      this.logger.info("Inbound email processing completed", {
        correlationId,
        stage,
        senderDomain: this.getEmailDomain(parsedEmail.envelopeFrom),
        receivingDomain: this.getEmailDomain(parsedEmail.envelopeTo),
        elapsedMs: Date.now() - startedAt,
      });
    } catch (error) {
      this.logProcessingFailure(error, parsedEmail, correlationId, stage, startedAt);
      if (error instanceof AmbiguousEmailDeliveryError) {
        return;
      }
      if (!config || !deliveryFingerprint) {
        return;
      }
      try {
        await this.handleProcessingError(
          email,
          error,
          parsedEmail,
          config,
          correlationId,
          deliveryFingerprint
        );
      } catch (boundaryError) {
        this.logger.error("Error fallback boundary failed", {
          correlationId,
          stage: "error-reply",
          senderDomain: this.getEmailDomain(parsedEmail.envelopeFrom),
          receivingDomain: this.getEmailDomain(parsedEmail.envelopeTo),
          ...getSafeErrorMetadata(boundaryError),
        });
      }
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

  /** Logs duplicate suppression without exposing fingerprint inputs or content. */
  private logDuplicateDelivery(
    parsedEmail: ParsedEmailData,
    correlationId: string,
    stage: EmailProcessingStage
  ): void {
    this.logger.info("Duplicate inbound delivery suppressed", {
      correlationId,
      stage,
      senderDomain: this.getEmailDomain(parsedEmail.envelopeFrom),
      receivingDomain: this.getEmailDomain(parsedEmail.envelopeTo),
    });
  }

  /** Logs processing failures with consistent context. */
  private logProcessingFailure(
    error: unknown,
    parsedEmail: ParsedEmailData,
    correlationId: string,
    stage: EmailProcessingStage,
    startedAt: number
  ): void {
    this.logger.error("Email processing failed", {
      correlationId,
      stage,
      senderDomain: this.getEmailDomain(parsedEmail.envelopeFrom),
      receivingDomain: this.getEmailDomain(parsedEmail.envelopeTo),
      elapsedMs: Date.now() - startedAt,
      ...getSafeErrorMetadata(error),
    });
  }

  /** Checks if email is from CAF-GPT itself to prevent loops. */
  private guardAgainstSelfLoop(parsedEmail: ParsedEmailData, config: AppConfig): boolean {
    if (!parsedEmail.envelopeFrom) {
      this.logger.warn("Email sender is missing, ignoring email to prevent processing errors");
      return true;
    }

    const normalizedFrom = normalizeEmailAddress(parsedEmail.envelopeFrom);
    const selfAddresses = new Set(
      [config.email.agentFromEmail, ...config.email.monitoredAddresses].map((address) =>
        normalizeEmailAddress(address)
      )
    );

    if (selfAddresses.has(normalizedFrom)) {
      this.logger.info("Ignoring email from self", {
        senderDomain: this.getEmailDomain(parsedEmail.envelopeFrom),
        receivingDomain: this.getEmailDomain(parsedEmail.envelopeTo),
      });
      return true;
    }
    return false;
  }

  /** Validates inbound content before recipient policy handles To/Cc candidates. */
  private validateEmail(parsedEmail: ParsedEmailData): void {
    const contentValidation = validateEmailContent(parsedEmail);
    if (!contentValidation.isValid) {
      this.logger.error("Email content validation failed", {
        errorCount: contentValidation.errors.length,
        senderDomain: this.getEmailDomain(parsedEmail.envelopeFrom),
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

  /** Sends a normal signed reply through the structured Email Service binding. */
  private async sendReply(
    parsedEmail: ParsedEmailData,
    content: string,
    config: AppConfig,
    recipients: ResolvedReplyRecipients,
    deliveryFingerprint: string,
    correlationId: string
  ): Promise<void> {
    const quotedContent = this.emailComposer.formatQuotedContent(parsedEmail);
    const replyText = htmlToText(content);
    const fullTextContent = (replyText ? replyText : content.trim()) + quotedContent;
    const htmlContent = this.htmlEmailComposer.composeHtmlReply(parsedEmail, content.trim());
    const subject = parsedEmail.subject.startsWith("Re:")
      ? parsedEmail.subject
      : `Re: ${parsedEmail.subject}`;
    const threadingOptions = this.buildThreadingOptions(parsedEmail);
    const replyFromAddress = this.resolveReplyFromAddress(parsedEmail, config);
    const signedHeaders = await signAgentHeaders(
      this.env.EMAIL_SECRET,
      AGENT_EMAIL_ROUTING_NAME,
      this.name
    );
    const headers = {
      ...threadingOptions.headers,
      ...(threadingOptions.inReplyTo ? { "In-Reply-To": threadingOptions.inReplyTo } : {}),
      ...signedHeaders,
    };

    if (!this.transitionDelivery(deliveryFingerprint, "processing", "send_started")) {
      throw new AmbiguousEmailDeliveryError("Delivery ledger was not sendable");
    }

    try {
      await this.env.EMAIL.send({
        to: recipients.to,
        ...(recipients.cc.length > 0 ? { cc: recipients.cc } : {}),
        from: { email: replyFromAddress, name: "CAF-GPT" },
        replyTo: replyFromAddress,
        subject,
        text: fullTextContent,
        html: htmlContent,
        headers,
      });

      this.transitionDelivery(deliveryFingerprint, "send_started", "sent");

      this.logger.info("Reply accepted by Email Service", {
        correlationId,
        stage: "successful-send",
        senderDomain: this.getEmailDomain(parsedEmail.envelopeFrom),
        receivingDomain: this.getEmailDomain(replyFromAddress),
        toCount: 1,
        ccCount: recipients.cc.length,
      });
    } catch (error) {
      this.transitionDelivery(deliveryFingerprint, "send_started", "send_unknown");
      this.logger.error("Failed to send reply via Email Service", {
        correlationId,
        stage: "successful-send",
        senderDomain: this.getEmailDomain(parsedEmail.envelopeFrom),
        ...getSafeErrorMetadata(error),
      });
      throw new AmbiguousEmailDeliveryError("Structured successful reply outcome is unknown");
    }
  }

  /** Schedules a durable memory update after the user-visible reply succeeds. */
  private async scheduleMemoryUpdate(
    emailContext: string,
    agentReply: string,
    deliveryFingerprint: string
  ): Promise<void> {
    try {
      await this.schedule<MemoryUpdateTask>(
        1,
        "runMemoryUpdate",
        { emailContext, agentReply, deliveryFingerprint },
        { retry: { maxAttempts: 3 }, idempotent: true }
      );
    } catch (error) {
      this.logger.error("Failed to schedule memory update", getSafeErrorMetadata(error));
    }
  }

  /** Attempts exactly one sender-only error reply and swallows every reply failure. */
  private async handleProcessingError(
    originalEmail: AgentEmail,
    error: unknown,
    parsedEmail: ParsedEmailData,
    config: AppConfig,
    correlationId: string,
    deliveryFingerprint: string
  ): Promise<void> {
    const envelopeSender = normalizeEmailAddress(parsedEmail.envelopeFrom);
    if (!isAuthorizedEmailAddress(envelopeSender, config.authorization)) {
      this.logger.warn("Skipping error reply to unauthorized or malformed envelope sender", {
        correlationId,
        senderDomain: this.getEmailDomain(envelopeSender),
        receivingDomain: this.getEmailDomain(parsedEmail.envelopeTo),
      });
      return;
    }

    if (!this.transitionDelivery(deliveryFingerprint, "processing", "error_reply_started")) {
      this.logger.info("Error reply suppressed by delivery ledger", {
        correlationId,
        stage: "error-reply",
        senderDomain: this.getEmailDomain(envelopeSender),
      });
      return;
    }

    try {
      await this.sendErrorResponse(originalEmail, error, parsedEmail, config);
      this.transitionDelivery(deliveryFingerprint, "error_reply_started", "error_replied");
    } catch (replyError) {
      this.transitionDelivery(deliveryFingerprint, "error_reply_started", "error_reply_unknown");
      this.logger.error("Failed to send error reply", {
        correlationId,
        senderDomain: this.getEmailDomain(envelopeSender),
        receivingDomain: this.getEmailDomain(parsedEmail.envelopeTo),
        ...getSafeErrorMetadata(replyError),
      });
    }
  }

  /** Sends a signed sender-only error response through the inbound Email Worker reply envelope. */
  private async sendErrorResponse(
    originalEmail: AgentEmail,
    error: unknown,
    parsedEmail: ParsedEmailData,
    config: AppConfig
  ): Promise<void> {
    const errorMessage = this.getErrorResponseMessage(error);
    const threadingOptions = this.buildThreadingOptions(parsedEmail);
    const replyFromAddress = this.resolveReplyFromAddress(parsedEmail, config);

    await this.replyToInboundEmail(originalEmail, {
      fromAddress: replyFromAddress,
      toAddress: normalizeEmailAddress(parsedEmail.envelopeFrom),
      subject: "Error Processing Email",
      text: errorMessage,
      threadingOptions,
    });

    this.logger.info("Sender-only error reply sent", {
      senderDomain: this.getEmailDomain(parsedEmail.envelopeFrom),
      receivingDomain: this.getEmailDomain(replyFromAddress),
      toCount: 1,
      ccCount: 0,
    });
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
    const inboundRecipient = normalizeEmailAddress(parsedEmail.envelopeTo);

    return monitoredAddresses.has(inboundRecipient)
      ? inboundRecipient
      : normalizeEmailAddress(config.email.agentFromEmail);
  }

  /** Builds threading options for reply MIME headers. */
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

  /** Creates an opaque fingerprint from normalized envelope identity and retained raw bytes. */
  private async createRawDeliveryFingerprint(
    email: AgentEmail,
    rawEmail: Uint8Array
  ): Promise<string> {
    const envelope = this.encodeFingerprintEnvelope(email);
    const input = new Uint8Array(envelope.length + rawEmail.length);
    input.set(envelope);
    input.set(rawEmail, envelope.length);
    return await this.sha256Hex(input);
  }

  /** Creates the best stable fingerprint available when inbound raw bytes cannot be read. */
  private async createFallbackDeliveryFingerprint(email: AgentEmail): Promise<string> {
    const headerEntries = Array.from(email.headers.entries())
      .map(([name, value]) => [name.toLowerCase(), value] as const)
      .sort(([leftName, leftValue], [rightName, rightValue]) =>
        leftName === rightName
          ? leftValue.localeCompare(rightValue)
          : leftName.localeCompare(rightName)
      );
    const fallback = JSON.stringify({
      envelope: [normalizeEmailAddress(email.from), normalizeEmailAddress(email.to)],
      rawSize: email.rawSize,
      headers: headerEntries,
    });
    return await this.sha256Hex(new TextEncoder().encode(fallback));
  }

  /** Encodes normalized envelope identity with a length boundary before raw fingerprint bytes. */
  private encodeFingerprintEnvelope(email: AgentEmail): Uint8Array {
    const identity = JSON.stringify([
      normalizeEmailAddress(email.from),
      normalizeEmailAddress(email.to),
    ]);
    return new TextEncoder().encode(`${identity.length}:${identity}`);
  }

  /** Returns a lowercase hexadecimal SHA-256 digest. */
  private async sha256Hex(input: Uint8Array): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", input);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(
      ""
    );
  }

  /** Atomically reserves a new delivery and prunes expired/excess ledger rows. */
  private reserveDelivery(deliveryFingerprint: string): boolean {
    this.ensureDeliveryLedger();
    const now = Date.now();
    const expiresBefore = now - DELIVERY_LEDGER_TTL_MS;
    this.sql`DELETE FROM caf_email_delivery_ledger WHERE updated_at < ${expiresBefore}`;
    this.sql`
      DELETE FROM caf_email_delivery_ledger
      WHERE fingerprint IN (
        SELECT fingerprint FROM caf_email_delivery_ledger
        ORDER BY updated_at DESC, fingerprint DESC
        LIMIT -1 OFFSET ${DELIVERY_LEDGER_MAX_ENTRIES - 1}
      )
    `;
    const inserted = this.sql<{ fingerprint: string }>`
      INSERT INTO caf_email_delivery_ledger (fingerprint, status, updated_at)
      VALUES (${deliveryFingerprint}, ${"processing"}, ${now})
      ON CONFLICT(fingerprint) DO NOTHING
      RETURNING fingerprint
    `;
    return inserted.length === 1;
  }

  /** Performs a guarded durable delivery-state transition. */
  private transitionDelivery(
    deliveryFingerprint: string,
    from: DeliveryLedgerStatus,
    to: DeliveryLedgerStatus
  ): boolean {
    this.ensureDeliveryLedger();
    const updated = this.sql<{ fingerprint: string }>`
      UPDATE caf_email_delivery_ledger
      SET status = ${to}, updated_at = ${Date.now()}
      WHERE fingerprint = ${deliveryFingerprint} AND status = ${from}
      RETURNING fingerprint
    `;
    return updated.length === 1;
  }

  /** Creates the application-owned delivery ledger table once per Agent isolate. */
  private ensureDeliveryLedger(): void {
    if (this.deliveryLedgerReady) {
      return;
    }
    this.sql`
      CREATE TABLE IF NOT EXISTS caf_email_delivery_ledger (
        fingerprint TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `;
    this.sql`
      CREATE INDEX IF NOT EXISTS idx_caf_email_delivery_ledger_updated
      ON caf_email_delivery_ledger(updated_at)
    `;
    this.deliveryLedgerReady = true;
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

  /** Extracts a normalized domain for structured sender metadata. */
  private getEmailDomain(address: string): string {
    const normalized = normalizeEmailAddress(address);
    return normalized.includes("@") ? normalized.slice(normalized.lastIndexOf("@") + 1) : "";
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
