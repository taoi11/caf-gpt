/**
 * src/agents/UserAgent.ts
 *
 * Durable Cloudflare Agents SDK email agent for per-user CAF-GPT processing
 *
 * Top-level declarations:
 * - UserAgentState: Persistent per-user state stored by the Agents runtime
 * - MemoryUpdateTask: Scheduled memory update payload
 * - UserAgent: Durable Object-backed email agent with AI response and memory scheduling
 * - persistPrunedVersions: Shared memory-version prune + conditional state write helper
 * - getUserAgentId: Converts a normalized sender email into a stable Agent instance id
 *
 * Clef (27B) prompt-injection/abuse screen runs in getAIResponse (with memory) before Prime Foo.
 * Clef-flash memory update gate runs in runMemoryUpdate before MemoryFoo.
 *
 * Replies carry only the agent answer and signature (no quoted history) and thread via
 * In-Reply-To/References. Prior turns the old quoted block carried are kept in DO SQLite
 * (utils/ThreadHistory) and appended to the model context of the user's next reply.
 *
 * Inbound logging contract: every onEmail invocation logs one receipt line, one line per skip path,
 * and exactly one terminal "Inbound email outcome" line, all tagged with the random per-message
 * emailRef the Worker assigns and passes in the internal x-caf-gpt-email-ref header, so it matches
 * the Worker boundary "Email routed" line. Logs never carry addresses (domains only), subjects,
 * bodies, prompts, or model output.
 */

import { Agent } from "agents";
import type { AgentEmail } from "agents/email";
import PostalMime, { type Address } from "postal-mime";
import type { AppConfig } from "../config";
import { createConfig } from "../config";
import { formatQuotedContent, HtmlEmailComposer } from "../email/components";
import type { ParsedEmailData } from "../email/types";
import { detectAutoReply } from "../email/utils/EmailLoopGuard";
import { getEmailRefFromHeaders, getLogSafeDomain } from "../email/utils/LogRedaction";
import { normalizeEmailAddress } from "../email/utils/EmailNormalizer";
import {
  isValidMessageId,
  parseMessageIdList,
  validateEmailContent,
} from "../email/utils/EmailValidator";
import { ERROR_RESPONSE_TEMPLATES } from "../email/utils/ErrorResponseTemplates";
import { htmlToText } from "../email/utils/HtmlToText";
import { normalizeReplySubject } from "../email/utils/ReplySubject";
import {
  isAuthorizedEmailAddress,
  type ResolvedReplyRecipients,
  resolveReplyRecipients,
} from "../email/utils/ReplyRecipients";
import { EmailValidationError } from "../errors";
import { getSafeErrorMetadata, Logger } from "../Logger";
import { AgentCoordinator } from "./AgentCoordinator";
import {
  MEMORY_MAX_CONTENT_LENGTH,
  type MemoryVersion,
  retainMemoryVersions,
} from "./memoryPolicy";
import { MemoryFooAgent } from "./sub-agents";
import { decideShouldReply, decideShouldUpdateMemory } from "./utils/ClefDecision";
import {
  loadThreadHistory,
  pruneThreadHistory,
  recordThreadTurn,
  THREAD_HISTORY_PRUNE_INTERVAL_SECONDS,
  type ThreadLookup,
} from "./utils/ThreadHistory";

const REFERENCES_MAX_LENGTH = 1000;

export interface UserAgentState {
  memory: string;
  versions: MemoryVersion[];
}

interface MemoryUpdateTask {
  emailContext: string;
  agentReply: string;
}

type ProcessingError = Error | string;

/** Terminal outcome of one inbound email invocation. */
type InboundOutcome = "replied" | "skipped" | "error";

/** Result of the sender-only error reply attempt on the error path. */
type ErrorReplyStatus = "sent" | "failed" | "skipped_unauthorized" | "not_attempted";

/** Content-free fields attached to every inbound email log line. */
interface InboundLogContext {
  emailRef: string;
  senderDomain: string;
}

/** Prime Foo response plus a content-free skip reason when no reply will be sent. */
interface AIResponseResult {
  shouldRespond: boolean;
  content?: string;
  skipReason?: string;
}

interface ReplyThreadingOptions {
  inReplyTo?: string;
  headers?: Record<string, string>;
}

interface EmailHeaderMap {
  [headerName: string]: string;
}

/** Converts a normalized sender email into a stable Agent instance id. */
export function getUserAgentId(senderEmail: string): string {
  return encodeURIComponent(normalizeEmailAddress(senderEmail));
}

/** Durable Object-backed email agent with AI response and memory scheduling. */
export class UserAgent extends Agent<Env, UserAgentState> {
  initialState: UserAgentState = { memory: "", versions: [] };
  override observability = undefined;

  private readonly logger = Logger.getInstance();
  private readonly htmlEmailComposer = new HtmlEmailComposer();
  private agentCoordinator?: AgentCoordinator;

  /** Rethrows SDK errors without the default detailed console output. */
  override onError<ConnectionOrError, ErrorValue>(
    connectionOrError: ConnectionOrError,
    error?: ErrorValue
  ): never {
    throw error ?? connectionOrError;
  }

  /** Handles inbound email routed by the Agents SDK. */
  async onEmail(email: AgentEmail): Promise<void> {
    const startTime = Date.now();
    const logContext: InboundLogContext = {
      emailRef: getEmailRefFromHeaders(email.headers),
      senderDomain: getLogSafeDomain(email.from),
    };
    this.logger.info("Inbound email received by UserAgent", {
      ...logContext,
      receivingDomain: getLogSafeDomain(email.to),
      rawSize: email.rawSize,
    });

    let config: AppConfig | undefined;
    let parsedEmail = this.buildEnvelopeEmailData(email);
    let sendAttempted = false;
    let outcome: InboundOutcome = "error";
    let outcomeReason = "unhandled";
    let errorReply: ErrorReplyStatus | undefined;

    try {
      config = createConfig(this.env);
      parsedEmail = this.buildFallbackEmailData(email);
      const rawEmail = await email.getRaw();
      parsedEmail = await this.parseEmail(email, rawEmail);

      const selfLoopReason = this.getSelfLoopSkipReason(parsedEmail, config);
      if (selfLoopReason) {
        this.logger.info("Inbound email skipped by self-loop guard", {
          ...logContext,
          skipReason: selfLoopReason,
        });
        outcome = "skipped";
        outcomeReason = selfLoopReason;
        return;
      }

      const autoReplyDetection = detectAutoReply(parsedEmail);
      if (autoReplyDetection.ignore) {
        // Only fixed category labels and allowlisted header names; `reasons` quotes header values.
        this.logger.info("Ignoring auto-reply or bounce email", {
          ...logContext,
          reasonCount: autoReplyDetection.reasons.length,
          categories: autoReplyDetection.categories,
          matchedHeaders: autoReplyDetection.matchedHeaders,
        });
        outcome = "skipped";
        outcomeReason = "auto_reply";
        return;
      }

      this.validateEmail(parsedEmail, logContext);
      const thread = this.loadThread(parsedEmail, logContext);
      const emailContext = this.buildEmailContext(parsedEmail) + thread.history;
      const response = await this.getAIResponse(emailContext, config, logContext);

      if (!response.shouldRespond || !response.content?.trim()) {
        this.logger.info("Inbound email completed without a reply", {
          ...logContext,
          skipReason: response.skipReason ?? "prime_foo_no_response",
        });
        outcome = "skipped";
        outcomeReason = response.skipReason ?? "prime_foo_no_response";
        return;
      }

      const recipients = resolveReplyRecipients(parsedEmail, config);
      const outboundMessageId = await this.sendReply(
        parsedEmail,
        response.content,
        config,
        recipients,
        () => {
          sendAttempted = true;
        }
      );
      await this.recordThread(parsedEmail, thread, outboundMessageId, logContext);
      await this.scheduleMemoryUpdate(emailContext, response.content);
      this.logger.info("Inbound email reply accepted", {
        ...logContext,
        toCount: recipients.to.length,
        ccCount: recipients.cc.length,
      });
      outcome = "replied";
      outcomeReason = "reply_sent";
    } catch (error) {
      this.logger.error("Email processing failed", {
        ...logContext,
        ...getSafeErrorMetadata(error),
        sendAttempted,
      });
      outcome = "error";
      outcomeReason = this.classifyProcessingFailure(error, sendAttempted, config);
      if (sendAttempted || !config) {
        errorReply = "not_attempted";
        return;
      }

      errorReply = await this.handleProcessingError(
        this.parseProcessingError(error),
        parsedEmail,
        config,
        logContext
      );
    } finally {
      const outcomeFields = {
        ...logContext,
        outcome,
        reason: outcomeReason,
        durationMs: Date.now() - startTime,
      };
      if (errorReply !== undefined) {
        Object.assign(outcomeFields, { errorReply });
      }
      if (outcome === "error") {
        this.logger.error("Inbound email outcome", outcomeFields);
      } else {
        this.logger.info("Inbound email outcome", outcomeFields);
      }
    }
  }

  /** Maps a caught inbound failure to a content-free terminal outcome reason. */
  private classifyProcessingFailure<ErrorValue>(
    error: ErrorValue,
    sendAttempted: boolean,
    config: AppConfig | undefined
  ): string {
    if (!config) return "config_unavailable";
    if (sendAttempted) return "reply_send_failed";
    if (error instanceof EmailValidationError) return "content_validation_failed";
    return "processing_failed";
  }

  /** Runs a durable scheduled memory update after a successful email reply. */
  async runMemoryUpdate(task: MemoryUpdateTask): Promise<void> {
    try {
      // Clef is a System One decision model; cast until wrangler AiModels lists it.
      const memoryGate = await decideShouldUpdateMemory(
        {
          run: (model, inputs) => this.env.AI.run(model as never, inputs as never),
        },
        task.emailContext,
        task.agentReply,
        this.state.memory
      );
      if (!memoryGate.shouldUpdate) {
        this.persistPrunedVersions(Date.now());
        this.logger.info("Clef memory gate skipped MemoryFoo", {
          reason: memoryGate.reason,
        });
        return;
      }

      const memoryAgent = new MemoryFooAgent(this.env, createConfig(this.env));
      const result = await memoryAgent.updateMemory(
        this.state.memory,
        task.emailContext,
        task.agentReply,
        { promptName: "memory_foo_edit" }
      );
      const now = Date.now();

      if (!result.updated || !result.content) {
        this.persistPrunedVersions(now);
        this.logger.info("User memory unchanged");
        return;
      }

      if (result.content.length > MEMORY_MAX_CONTENT_LENGTH) {
        this.persistPrunedVersions(now);
        this.logger.warn("Rejected oversize memory update", {
          contentLength: result.content.length,
        });
        return;
      }

      // Success path: prune for nextVersions only — one setState, no intermediate write.
      const versions = retainMemoryVersions(this.state.versions ?? [], now);
      const previous = this.state.memory;
      const nextVersions =
        previous.trim().length > 0
          ? retainMemoryVersions([...versions, { ts: now, text: previous }], now)
          : versions;

      this.setState({ memory: result.content, versions: nextVersions });
      this.logger.info("User memory updated successfully", {
        contentLength: result.content.length,
      });
    } catch (error) {
      this.logger.error("Memory update failed", getSafeErrorMetadata(error));
      throw new Error("Scheduled memory update failed");
    }
  }

  /**
   * Prunes expired memory versions and persists when the list changed.
   * @returns The pruned versions list for callers that continue updating state
   */
  private persistPrunedVersions(now: number): MemoryVersion[] {
    const storedVersions = this.state.versions ?? [];
    const versions = retainMemoryVersions(storedVersions, now);
    if (
      versions.length !== storedVersions.length ||
      versions.some((version, index) => version !== storedVersions[index])
    ) {
      this.setState({ memory: this.state.memory, versions });
    }
    return versions;
  }

  /** Parses an AgentEmail into CAF-GPT's internal ParsedEmailData shape. */
  private async parseEmail(email: AgentEmail, rawEmail: Uint8Array): Promise<ParsedEmailData> {
    const parser = new PostalMime();
    const parsed = await parser.parse(rawEmail);
    const headers = this.buildHeaderMap(email.headers);
    const rawTextBody = parsed.text ?? "";
    const rawHtmlBody = parsed.html;
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

  /** Returns a skip reason when the email is from CAF-GPT itself (or has no sender) to prevent loops. */
  private getSelfLoopSkipReason(
    parsedEmail: ParsedEmailData,
    config: AppConfig
  ): "missing_sender" | "self_sender" | undefined {
    if (!parsedEmail.envelopeFrom) {
      return "missing_sender";
    }

    const normalizedFrom = normalizeEmailAddress(parsedEmail.envelopeFrom);
    const selfAddresses = new Set(
      [config.email.agentFromEmail, ...config.email.monitoredAddresses].map((address) =>
        normalizeEmailAddress(address)
      )
    );

    return selfAddresses.has(normalizedFrom) ? "self_sender" : undefined;
  }

  /** Validates inbound content before recipient policy handles reply-all candidates. */
  private validateEmail(parsedEmail: ParsedEmailData, logContext: InboundLogContext): void {
    const contentValidation = validateEmailContent(parsedEmail);
    if (!contentValidation.isValid) {
      this.logger.error("Email content validation failed", {
        ...logContext,
        errorCount: contentValidation.errors.length,
      });
      throw new EmailValidationError("Inbound email content failed validation");
    }

    if (contentValidation.warnings.length > 0) {
      this.logger.warn("Email content warnings", {
        ...logContext,
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
    config: AppConfig,
    logContext: InboundLogContext
  ): Promise<AIResponseResult> {
    // Clef is a System One decision model; cast until wrangler AiModels lists it.
    const replyGate = await decideShouldReply(
      {
        run: (model, inputs) => this.env.AI.run(model as never, inputs as never),
      },
      emailContext,
      this.state.memory
    );
    const gateFields = {
      ...logContext,
      reason: replyGate.reason,
      choice: replyGate.choice ?? "none",
      confidence: replyGate.confidence ?? null,
    };
    if (!replyGate.shouldReply) {
      this.logger.info("Clef injection screen blocked Prime Foo", gateFields);
      return { shouldRespond: false, skipReason: replyGate.reason };
    }
    this.logger.info("Clef injection screen allowed Prime Foo", gateFields);

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
  ): Promise<string | undefined> {
    // Answer + signature only; the client renders the thread from In-Reply-To/References.
    const replyText = htmlToText(content);
    const fullTextContent = replyText || content.trim();
    const htmlContent = this.htmlEmailComposer.composeHtmlReply(content.trim());
    const subject = normalizeReplySubject(parsedEmail.subject);
    const threadingOptions = this.buildThreadingOptions(parsedEmail);
    const replyFromAddress = this.resolveReplyFromAddress(parsedEmail, config);

    markSendAttempted();
    const emailOptions = {
      binding: this.env.EMAIL,
      to: recipients.to,
      from: { email: replyFromAddress, name: "CAF-GPT" },
      replyTo: replyFromAddress,
      subject,
      text: fullTextContent,
      html: htmlContent,
      inReplyTo: threadingOptions.inReplyTo,
      headers: threadingOptions.headers,
    };
    if (recipients.cc.length > 0) {
      Object.assign(emailOptions, { cc: recipients.cc });
    }
    const result = await this.sendEmail(emailOptions);
    return result?.messageId;
  }

  /** Loads stored prior turns for the thread this email continues; storage failure yields none. */
  private loadThread(parsedEmail: ParsedEmailData, logContext: InboundLogContext): ThreadLookup {
    try {
      return loadThreadHistory(this.sql.bind(this), parsedEmail, Date.now());
    } catch (error) {
      this.logger.warn("Thread history load failed", {
        ...logContext,
        ...getSafeErrorMetadata(error),
      });
      return { history: "" };
    }
  }

  /**
   * Stores the answered inbound email as the thread's newest turn and keeps a daily prune
   * schedule (idempotent) so retention holds even if the user never writes again.
   * Never fails the reply.
   */
  private async recordThread(
    parsedEmail: ParsedEmailData,
    thread: ThreadLookup,
    outboundMessageId: string | undefined,
    logContext: InboundLogContext
  ): Promise<void> {
    try {
      recordThreadTurn(
        this.sql.bind(this),
        parsedEmail,
        formatQuotedContent(parsedEmail),
        thread.threadId,
        outboundMessageId,
        Date.now()
      );
      await this.scheduleEvery(THREAD_HISTORY_PRUNE_INTERVAL_SECONDS, "runThreadHistoryPrune");
    } catch (error) {
      this.logger.warn("Thread history save failed", {
        ...logContext,
        ...getSafeErrorMetadata(error),
      });
    }
  }

  /** Scheduled: prunes expired thread history; cancels itself once no turns remain. */
  async runThreadHistoryPrune(_payload: unknown, schedule?: { id: string }): Promise<void> {
    const remaining = pruneThreadHistory(this.sql.bind(this), Date.now());
    if (remaining === 0 && schedule) {
      await this.cancelSchedule(schedule.id);
    }
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

  /** Attempts one sender-only structured error reply, swallows every reply failure, and reports the result. */
  private async handleProcessingError(
    error: ProcessingError,
    parsedEmail: ParsedEmailData,
    config: AppConfig,
    logContext: InboundLogContext
  ): Promise<ErrorReplyStatus> {
    const envelopeSender = normalizeEmailAddress(parsedEmail.envelopeFrom);
    if (!isAuthorizedEmailAddress(envelopeSender, config.authorization)) {
      this.logger.warn(
        "Skipping error reply to unauthorized or malformed envelope sender",
        logContext
      );
      return "skipped_unauthorized";
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
      this.logger.info("Sender-only error reply sent", logContext);
      return "sent";
    } catch (replyError) {
      this.logger.error("Failed to send error reply", {
        ...logContext,
        ...getSafeErrorMetadata(replyError),
      });
      return "failed";
    }
  }

  /** Gets a user-friendly error response message. */
  private getErrorResponseMessage(error: ProcessingError): string {
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
  private buildThreadingOptions(parsedEmail: ParsedEmailData): ReplyThreadingOptions {
    if (!parsedEmail.messageId || !isValidMessageId(parsedEmail.messageId)) {
      return {};
    }

    const references = this.buildReferencesHeader(parsedEmail);
    const threadingOptions: ReplyThreadingOptions = {
      inReplyTo: parsedEmail.messageId,
    };
    if (references) {
      threadingOptions.headers = { References: references };
    }
    return threadingOptions;
  }

  /** Converts a caught value into the error contract used for sender-facing templates. */
  private parseProcessingError<ErrorValue>(error: ErrorValue): ProcessingError {
    return error instanceof Error ? error : String(error);
  }

  /** Builds the reply References chain from prior threading headers plus the original Message-ID. */
  private buildReferencesHeader(parsedEmail: ParsedEmailData): string {
    const messageId = parsedEmail.messageId;
    if (!messageId || !isValidMessageId(messageId)) {
      return "";
    }

    const inboundReferences = parseMessageIdList(parsedEmail.references);
    const priorMessageIds =
      inboundReferences.length > 0 ? inboundReferences : parseMessageIdList(parsedEmail.inReplyTo);
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
  private buildHeaderMap(headers: Headers): EmailHeaderMap {
    const normalized: EmailHeaderMap = {};

    headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      normalized[lowerKey] = normalized[lowerKey] ? `${normalized[lowerKey]}, ${value}` : value;
    });

    return normalized;
  }
}
