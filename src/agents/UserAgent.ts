/**
 * src/agents/UserAgent.ts
 *
 * Durable Cloudflare Agents SDK email agent for per-user CAF-GPT processing
 *
 * Top-level declarations:
 * - UserAgentState: Persistent per-user state stored by the Agents runtime
 * - MemoryUpdateTask: Scheduled memory update payload
 * - ResendInboundTask: One Resend inbound email handed from the Worker webhook route
 * - InboundAcceptance: Whether receiveResendEmail accepted the email or saw a duplicate
 * - UserAgent: Durable Object-backed email agent with AI response and memory scheduling
 * - persistPrunedVersions: Shared memory-version prune + conditional state write helper
 * - getUserAgentId: Converts a normalized sender email into a stable Agent instance id
 *
 * Mail path (Resend Inboxes): the Worker verifies the inbox.email.received webhook and calls
 * receiveResendEmail, which records the Resend email id in DO SQLite (utils/InboundLedger) so a
 * retried or replayed webhook never gets a second reply, then schedules processResendEmail and
 * returns at once (the webhook must answer quickly). processResendEmail reads the inbox address,
 * Resend's receive-time SPF/DKIM/DMARC results and the original raw MIME, and only answers when
 * the From domain is authenticated (DMARC pass or aligned DKIM pass).
 *
 * Clef (27B) prompt-injection/abuse screen runs in getAIResponse (with memory) before Prime Foo.
 * Clef-flash memory update gate runs in runMemoryUpdate before MemoryFoo.
 *
 * Replies carry the agent answer and signature, then Outlook-style quoted history of the inbound
 * email (components/QuotedHistory; its body already carries the earlier chain). A quote that
 * cannot be built throws QuotedHistoryError before sending, so the funny error reply runs instead
 * of a quoteless reply. The quote's Sent: line uses the user's UTC offset learned from their own
 * Outlook quote of our previous reply (utils/SentTimeZone); a quoted CAF-GPT Sent: line that
 * teaches nothing is logged at error level with a fixed reason and the reply still goes out with
 * the saved offset or America/Edmonton. Replies go out through Resend's thread reply endpoint,
 * which sends from the inbox address to the message's Reply-To (else its sender) and sets
 * In-Reply-To/References itself; CAF-GPT adds the CC list and a child Thread-Index/Thread-Topic
 * when the inbound email has a Thread-Index (Exchange groups conversations by it). The reply's
 * Message-ID is read back from Resend for the Sent-offset and thread matching. Prior turns
 * (inbound email plus our reply) are kept in DO SQLite (utils/ThreadHistory) and appended to the
 * model context of the user's next reply.
 *
 * Inbound logging contract: every processResendEmail run logs one receipt line, one line per skip
 * path, and exactly one terminal "Inbound email outcome" line, all tagged with the random
 * per-message emailRef the Worker assigned, so it matches the Worker boundary "Email routed" line.
 * Logs never carry addresses (domains only), subjects, bodies, Message-IDs, header values,
 * prompts, or model output; Resend ids are opaque and logged only for correlation.
 */

import { Agent } from "agents";
import type { AppConfig } from "../config";
import { createConfig } from "../config";
import {
  buildQuotedHistory,
  formatQuotedContent,
  HtmlEmailComposer,
  OUTLOOK_SENT_TIME_ZONE,
} from "../email/components";
import {
  buildEnvelopeEmailData,
  isSenderAuthenticated,
  parseInboundEmail,
} from "../email/resend/InboundEmail";
import { ResendClient, type ThreadReplyRequest } from "../email/resend/ResendClient";
import type { ParsedEmailData } from "../email/types";
import { detectAutoReply } from "../email/utils/EmailLoopGuard";
import {
  getLogSafeDomain,
  getResendErrorFields,
  toEmailRef,
  toLoggableQuoteDiagnostics,
  toLoggableResendId,
  toLoggableSentZoneDiagnostics,
} from "../email/utils/LogRedaction";
import { normalizeEmailAddress } from "../email/utils/EmailNormalizer";
import { validateEmailContent } from "../email/utils/EmailValidator";
import { ERROR_RESPONSE_TEMPLATES } from "../email/utils/ErrorResponseTemplates";
import { htmlToText } from "../email/utils/HtmlToText";
import { buildOutlookThreadHeaders } from "../email/utils/OutlookThreading";
import { normalizeReplySubject } from "../email/utils/ReplySubject";
import { describeThreadTopic } from "../email/utils/ThreadTopicDiagnostics";
import {
  isAuthorizedEmailAddress,
  type ResolvedReplyRecipients,
  resolveReplyRecipients,
} from "../email/utils/ReplyRecipients";
import {
  EmailParsingError,
  EmailValidationError,
  QuotedHistoryError,
  ResendAPIError,
} from "../errors";
import { getSafeErrorMetadata, Logger } from "../Logger";
import { AgentCoordinator } from "./AgentCoordinator";
import {
  MEMORY_MAX_CONTENT_LENGTH,
  type MemoryVersion,
  retainMemoryVersions,
} from "./memoryPolicy";
import { MemoryFooAgent } from "./sub-agents";
import { decideShouldReply, decideShouldUpdateMemory } from "./utils/ClefDecision";
import { claimInboundEmail, pruneInboundLedger, releaseInboundEmail } from "./utils/InboundLedger";
import {
  listPendingSentTimes,
  pruneSentTimes,
  recordPendingSentTime,
  recordReplySentTime,
  resolvePendingSentTime,
  resolveSentZone,
  type SentZoneDecision,
  saveSentOffset,
} from "./utils/SentTimeZone";
import {
  linkThreadMessageId,
  loadThreadHistory,
  pruneThreadHistory,
  recordThreadTurn,
  THREAD_HISTORY_MAX_CHARS,
  THREAD_HISTORY_PRUNE_INTERVAL_SECONDS,
  type ThreadLookup,
} from "./utils/ThreadHistory";

/** Most pending reply Message-IDs looked up per inbound email. */
const PENDING_SENT_LOOKUP_LIMIT = 5;

/** Longest reply subject Resend accepts. */
const REPLY_SUBJECT_MAX_LENGTH = 2000;

export interface UserAgentState {
  memory: string;
  versions: MemoryVersion[];
}

interface MemoryUpdateTask {
  emailContext: string;
  agentReply: string;
}

/** One Resend inbound email, handed from the Worker webhook route to the sender's UserAgent. */
export interface ResendInboundTask {
  /** Random per-message correlation id the Worker assigned. */
  emailRef: string;
  inboxId: string;
  threadId: string;
  emailId: string;
  /** RFC 5322 From from the webhook; answered only once Resend's checks authenticate its domain. */
  from: string;
  /** Reply-To addresses from the webhook; the error reply is skipped when they name anyone else. */
  replyTo: string[];
}

/** Whether receiveResendEmail accepted the email or saw a duplicate delivery. */
export type InboundAcceptance = "accepted" | "duplicate";

type ProcessingError = Error | string;

/** Terminal outcome of one inbound email invocation. */
type InboundOutcome = "replied" | "skipped" | "error";

/** Result of the sender-only error reply attempt on the error path. */
type ErrorReplyStatus =
  | "sent"
  | "failed"
  | "skipped_unauthorized"
  | "skipped_unauthenticated"
  | "skipped_reply_to"
  | "not_attempted";

/** Where the reply's send time was stored. */
type SentTimeStatus = "recorded" | "pending" | "failed";

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

/** Content-free result of the normal reply send. */
interface SentReply {
  /** Resend id of the sent reply (the reply endpoint returns no Message-ID). */
  resendEmailId: string;
  outlookThreaded: boolean;
  quotedHtml: boolean;
  quoteSourceBytes: number;
  quoteRemovedNodes: number;
  /** Epoch milliseconds captured immediately before the reply request. */
  sentAtMs: number;
  sentZone: SentZoneDecision;
  /** True when the recipients Resend will use differ from CAF-GPT's recipient policy. */
  recipientsDiffer: boolean;
  ccCount: number;
}

/** Converts a normalized sender email into a stable Agent instance id. */
export function getUserAgentId(senderEmail: string): string {
  return encodeURIComponent(normalizeEmailAddress(senderEmail));
}

/** Removes line breaks, which Resend rejects in subjects and header values. */
function stripLineBreaks(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
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

  /**
   * Accepts one verified Resend inbound email from the Worker webhook route. The email id is
   * recorded first, so a retried or replayed webhook for the same email returns "duplicate" and is
   * never processed twice; processing is then scheduled durably and this returns at once, because
   * the LLM work outlasts the webhook response deadline. If scheduling fails the claim is released
   * and the error propagates, so the Worker answers 5xx and Resend retries.
   * @param task - Ids, sender and emailRef from the Worker
   */
  async receiveResendEmail(task: ResendInboundTask): Promise<InboundAcceptance> {
    const logContext: InboundLogContext = {
      emailRef: toEmailRef(task.emailRef),
      senderDomain: getLogSafeDomain(task.from),
    };

    const sql = this.sql.bind(this);

    if (!claimInboundEmail(sql, task.emailId, Date.now())) {
      this.logger.info("Inbound email duplicate delivery ignored", {
        ...logContext,
        resendEmailId: toLoggableResendId(task.emailId),
      });

      return "duplicate";
    }

    try {
      await this.scheduleEvery(THREAD_HISTORY_PRUNE_INTERVAL_SECONDS, "runThreadHistoryPrune");
      await this.schedule<ResendInboundTask>(0, "processResendEmail", task, {
        retry: { maxAttempts: 1 },
      });
    } catch (error) {
      releaseInboundEmail(sql, task.emailId);
      this.logger.error("Inbound email scheduling failed", {
        ...logContext,
        ...getSafeErrorMetadata(error),
      });
      throw error;
    }

    this.logger.info("Inbound email accepted by UserAgent", {
      ...logContext,
      resendEmailId: toLoggableResendId(task.emailId),
    });

    return "accepted";
  }

  /**
   * Scheduled: processes one accepted Resend inbound email end to end. Never throws, so the
   * scheduler never retries it (a retry could send a second reply).
   * @param task - Payload stored by receiveResendEmail
   */
  async processResendEmail(task: ResendInboundTask): Promise<void> {
    const startTime = Date.now();

    const logContext: InboundLogContext = {
      emailRef: toEmailRef(task.emailRef),
      senderDomain: getLogSafeDomain(task.from),
    };

    this.logger.info("Inbound email received by UserAgent", {
      ...logContext,
      resendEmailId: toLoggableResendId(task.emailId),
    });

    let config: AppConfig | undefined;
    let client: ResendClient | undefined;
    let parsedEmail = buildEnvelopeEmailData({ from: task.from, to: "" });
    let senderAuthenticated = false;
    let sendAttempted = false;
    let outcome: InboundOutcome = "error";
    let outcomeReason = "unhandled";
    let errorReply: ErrorReplyStatus | undefined;

    try {
      config = createConfig(this.env);
      client = this.createResendClient();
      const inboxAddress = await client.getInboxAddress(task.inboxId);
      const envelope = { from: task.from, to: inboxAddress };
      parsedEmail = buildEnvelopeEmailData(envelope);

      if (!this.isMonitoredAddress(inboxAddress, config)) {
        this.logger.info("Inbound email skipped - inbox not monitored", {
          ...logContext,
          receivingDomain: getLogSafeDomain(inboxAddress),
        });
        outcome = "skipped";
        outcomeReason = "recipient_not_monitored";

        return;
      }

      const received = await client.getReceivedEmail(task.emailId);

      if (!isSenderAuthenticated(received.authentication)) {
        // Verdicts are fixed enum values computed by Resend on receipt, never header text.
        this.logger.warn("Inbound email skipped - sender not authenticated", {
          ...logContext,
          authenticationMissing: received.authentication === null,
          spf: received.authentication?.spf ?? "unknown",
          dkim: received.authentication?.dkim ?? "unknown",
          dmarc: received.authentication?.dmarc ?? "unknown",
        });
        outcome = "skipped";
        outcomeReason = "sender_not_authenticated";

        return;
      }

      senderAuthenticated = true;

      if (!received.rawDownloadUrl) {
        throw new EmailParsingError("Raw email unavailable");
      }

      const rawEmail = await client.downloadRawEmail(received.rawDownloadUrl);
      parsedEmail = await parseInboundEmail(rawEmail, envelope);

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
      await this.resolvePendingSentTimes(client, logContext);
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

      const sentReply = await this.sendReply(
        client,
        task,
        parsedEmail,
        response.content,
        config,
        recipients,
        logContext,
        () => {
          sendAttempted = true;
        }
      );

      const outboundMessageId = await this.lookupSentMessageId(
        client,
        sentReply.resendEmailId,
        logContext
      );

      const threadId = await this.recordThread(
        parsedEmail,
        response.content,
        thread,
        outboundMessageId,
        logContext
      );

      const sentTime = await this.recordSentTime(
        sentReply,
        outboundMessageId,
        threadId,
        logContext
      );

      await this.scheduleMemoryUpdate(emailContext, response.content);
      this.logger.info("Inbound email reply accepted", {
        ...logContext,
        toCount: recipients.to.length,
        ccCount: sentReply.ccCount,
        recipientsDiffer: sentReply.recipientsDiffer,
        outlookThreaded: sentReply.outlookThreaded,
        ...toLoggableQuoteDiagnostics({
          quotedHistoryIncluded: true,
          quotedHtml: sentReply.quotedHtml,
          quoteSourceBytes: sentReply.quoteSourceBytes,
          quoteRemovedNodes: sentReply.quoteRemovedNodes,
        }),
        ...toLoggableSentZoneDiagnostics(sentReply.sentZone),
        sentTimeRecorded: sentTime === "recorded",
        sentTimePending: sentTime === "pending",
        resendReplyId: toLoggableResendId(sentReply.resendEmailId),
        ...describeThreadTopic(parsedEmail.headers, parsedEmail.subject),
      });
      outcome = "replied";
      outcomeReason = "reply_sent";
    } catch (error) {
      this.logger.error("Email processing failed", {
        ...logContext,
        ...getSafeErrorMetadata(error),
        ...getResendErrorFields(error),
        sendAttempted,
      });
      outcome = "error";
      outcomeReason = this.classifyProcessingFailure(error, sendAttempted, config, client);

      if (sendAttempted || !config || !client) {
        errorReply = "not_attempted";

        return;
      }

      errorReply = await this.handleProcessingError(
        this.parseProcessingError(error),
        client,
        task,
        parsedEmail,
        senderAuthenticated,
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

  /**
   * Creates the Resend client from RESEND_API_KEY; throws when it is not configured, so the
   * email fails loudly as config_unavailable instead of silently.
   */
  protected createResendClient(): ResendClient {
    if (!this.env.RESEND_API_KEY) {
      throw new Error("Resend API key is not configured");
    }

    return new ResendClient(this.env.RESEND_API_KEY);
  }

  /** Whether an address is one of CAF-GPT's monitored inbox addresses. */
  private isMonitoredAddress(address: string, config: AppConfig): boolean {
    const normalized = normalizeEmailAddress(address);

    return config.email.monitoredAddresses.some(
      (monitored) => normalizeEmailAddress(monitored) === normalized
    );
  }

  /** Maps a caught inbound failure to a content-free terminal outcome reason. */
  private classifyProcessingFailure<ErrorValue>(
    error: ErrorValue,
    sendAttempted: boolean,
    config: AppConfig | undefined,
    client: ResendClient | undefined
  ): string {
    if (!config || !client) return "config_unavailable";

    if (sendAttempted) return "reply_send_failed";

    if (error instanceof QuotedHistoryError) return error.reason;

    if (error instanceof EmailValidationError) return "content_validation_failed";

    if (error instanceof ResendAPIError) return "resend_api_failed";

    return "processing_failed";
  }

  /** Runs a durable scheduled memory update after a successful email reply. */
  async runMemoryUpdate(task: MemoryUpdateTask): Promise<void> {
    try {
      // Clef is a System One decision model; cast until wrangler AiModels lists it.
      const memoryGate = await decideShouldUpdateMemory(
        {
          // SAFETY: ClefDecision constructs System One requests; generated AiModels does not yet list Clef.
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
        // SAFETY: ClefDecision constructs System One requests; generated AiModels does not yet list Clef.
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

  /**
   * Sends the normal reply through Resend's thread reply endpoint. Resend picks the To (the
   * message's Reply-To, else its sender) and sets In-Reply-To/References; CAF-GPT sends the CC
   * list from its recipient policy and the Outlook Thread-Index/Thread-Topic. The idempotency key
   * is the inbound email id, so a repeated request within 24 h never sends a second reply.
   */
  private async sendReply(
    client: ResendClient,
    task: ResendInboundTask,
    parsedEmail: ParsedEmailData,
    content: string,
    config: AppConfig,
    recipients: ResolvedReplyRecipients,
    logContext: InboundLogContext,
    markSendAttempted: () => void
  ): Promise<SentReply> {
    // Answer + signature, then the Outlook-style quote of the inbound email (carrying its chain).
    // Built before markSendAttempted so a failure still gets the funny error reply.
    const sentZone = this.resolveQuotedSentZone(parsedEmail, config, logContext);
    const quoted = buildQuotedHistory(parsedEmail, sentZone.zone);

    if (!quoted.ok) {
      this.logger.error("Quoted history build failed", {
        ...logContext,
        ...toLoggableQuoteDiagnostics({
          quotedHistoryIncluded: false,
          quoteFailureReason: quoted.reason,
        }),
      });
      throw new QuotedHistoryError(quoted.reason);
    }

    const replyText = htmlToText(content);
    const fullTextContent = `${replyText || content.trim()}\n\n${quoted.quote.text}`;
    const htmlContent = this.htmlEmailComposer.composeHtmlReply(content.trim(), quoted.quote.html);

    const subject = stripLineBreaks(normalizeReplySubject(parsedEmail.subject)).slice(
      0,
      REPLY_SUBJECT_MAX_LENGTH
    );

    const outlookHeaders = buildOutlookThreadHeaders(
      parsedEmail.headers,
      parsedEmail.subject,
      Date.now()
    );

    const resendTo = this.getResendReplyTo(parsedEmail);

    // Resend fixes To itself (Reply-To, else From); policy To mailboxes it would not reach move to Cc.
    const cc = [...recipients.to, ...recipients.cc].filter(
      (address, index, all) => !resendTo.includes(address) && all.indexOf(address) === index
    );

    const recipientsDiffer =
      resendTo.length !== recipients.to.length ||
      resendTo.some((address) => !recipients.to.includes(address));

    if (recipientsDiffer) {
      this.logger.warn("Reply To set by Resend differs from recipient policy", {
        ...logContext,
        policyToCount: recipients.to.length,
        resendToCount: resendTo.length,
      });
    }

    const reply: ThreadReplyRequest = {
      subject,
      html: htmlContent,
      text: fullTextContent,
      reply_all: false,
    };

    if (cc.length > 0) reply.cc = cc;

    const headers: Record<string, string> = {};

    for (const [name, value] of Object.entries(outlookHeaders)) {
      if (value) headers[name] = stripLineBreaks(value);
    }

    if (Object.keys(headers).length > 0) reply.headers = headers;

    markSendAttempted();

    const sentAtMs = Date.now();

    const resendEmailId = await client.replyToThreadEmail(
      task.inboxId,
      task.threadId,
      task.emailId,
      reply,
      `caf-gpt-reply/${task.emailId}`
    );

    return {
      resendEmailId,
      sentAtMs,
      sentZone,
      outlookThreaded: outlookHeaders["Thread-Index"] !== undefined,
      quotedHtml: quoted.quote.quotedHtml,
      quoteSourceBytes: quoted.quote.sourceBytes,
      quoteRemovedNodes: quoted.quote.removedNodes,
      recipientsDiffer,
      ccCount: cc.length,
    };
  }

  /**
   * The To Resend uses for a reply: the inbound message's Reply-To addresses, else its sender
   * (https://resend.com/docs/api-reference/inboxes/reply-thread-email).
   */
  private getResendReplyTo(parsedEmail: ParsedEmailData): string[] {
    const replyTo = parsedEmail.replyTo.filter(Boolean);

    return replyTo.length > 0 ? [...new Set(replyTo)] : [parsedEmail.from].filter(Boolean);
  }

  /**
   * Reads the Message-ID Resend assigned the reply. Never fails the reply: a lookup failure or a
   * Message-ID not assigned yet returns undefined and the send time is kept as pending.
   */
  private async lookupSentMessageId(
    client: ResendClient,
    resendEmailId: string,
    logContext: InboundLogContext
  ): Promise<string | undefined> {
    try {
      return await client.getSentMessageId(resendEmailId);
    } catch (error) {
      this.logger.warn("Reply Message-ID lookup failed", {
        ...logContext,
        ...getSafeErrorMetadata(error),
        ...getResendErrorFields(error),
      });

      return undefined;
    }
  }

  /**
   * Looks up the Message-IDs of earlier replies Resend had not assigned at send time and moves
   * their send times (and thread links) under them, so this email's quote can match. Capped per
   * email and never fails processing.
   */
  private async resolvePendingSentTimes(
    client: ResendClient,
    logContext: InboundLogContext
  ): Promise<void> {
    try {
      const sql = this.sql.bind(this);
      const pending = listPendingSentTimes(sql, Date.now(), PENDING_SENT_LOOKUP_LIMIT);

      if (pending.length === 0) return;
      let resolvedCount = 0;

      for (const entry of pending) {
        const messageId = await client.getSentMessageId(entry.resendEmailId);

        if (!messageId || !resolvePendingSentTime(sql, entry, messageId, Date.now())) continue;

        if (entry.threadId) linkThreadMessageId(sql, entry.threadId, messageId, Date.now());
        resolvedCount++;
      }

      this.logger.info("Pending reply Message-IDs looked up", {
        ...logContext,
        pendingCount: pending.length,
        resolvedCount,
      });
    } catch (error) {
      this.logger.warn("Pending reply Message-ID lookup failed", {
        ...logContext,
        ...getSafeErrorMetadata(error),
        ...getResendErrorFields(error),
      });
    }
  }

  /**
   * Decides the quoted Sent: zone. A quoted CAF-GPT Sent: line that cannot be parsed or matched
   * (or a storage failure) is logged at error level with a fixed reason, but never blocks the
   * reply: it goes out with the saved offset or America/Edmonton.
   */
  private resolveQuotedSentZone(
    parsedEmail: ParsedEmailData,
    config: AppConfig,
    logContext: InboundLogContext
  ): SentZoneDecision {
    const selfAddresses = [config.email.agentFromEmail, ...config.email.monitoredAddresses].map(
      (address) => normalizeEmailAddress(address)
    );

    let decision: SentZoneDecision;

    try {
      decision = resolveSentZone(this.sql.bind(this), parsedEmail, selfAddresses, Date.now());
    } catch (error) {
      decision = {
        zone: { timeZone: OUTLOOK_SENT_TIME_ZONE },
        source: "default",
        lineFound: false,
        reason: "quoted_sent_storage_failed",
      };
      this.logger.error("Quoted Sent time zone storage failed", {
        ...logContext,
        ...getSafeErrorMetadata(error),
      });
    }

    if (decision.reason) {
      this.logger.error("Quoted Sent time zone not learned", {
        ...logContext,
        ...toLoggableSentZoneDiagnostics(decision),
      });
    }

    return decision;
  }

  /**
   * Stores the reply's real UTC send time (and a newly learned offset) for the user's next reply:
   * under its Message-ID when Resend reported one, else as pending under the Resend id. The daily
   * prune schedule is ensured first so retention holds. Never fails the reply.
   */
  private async recordSentTime(
    sentReply: SentReply,
    outboundMessageId: string | undefined,
    threadId: string | undefined,
    logContext: InboundLogContext
  ): Promise<SentTimeStatus> {
    try {
      await this.scheduleEvery(THREAD_HISTORY_PRUNE_INTERVAL_SECONDS, "runThreadHistoryPrune");
      const now = Date.now();
      const sql = this.sql.bind(this);

      if (
        sentReply.sentZone.source === "learned" &&
        sentReply.sentZone.offsetMinutes !== undefined
      ) {
        saveSentOffset(sql, sentReply.sentZone.offsetMinutes, now);
      }

      if (recordReplySentTime(sql, outboundMessageId, sentReply.sentAtMs, now)) return "recorded";

      recordPendingSentTime(sql, sentReply.resendEmailId, sentReply.sentAtMs, threadId, now);

      return "pending";
    } catch (error) {
      this.logger.warn("Reply send time save failed", {
        ...logContext,
        ...getSafeErrorMetadata(error),
      });

      return "failed";
    }
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
   * Stores the answered inbound email and our reply as the thread's newest turn. The daily prune
   * schedule (idempotent) is ensured first, so nothing is stored without one and retention holds
   * even if the user never writes again. Never fails the reply.
   * @returns The thread id the turn was stored under, for linking a late reply Message-ID
   */
  private async recordThread(
    parsedEmail: ParsedEmailData,
    replyContent: string,
    thread: ThreadLookup,
    outboundMessageId: string | undefined,
    logContext: InboundLogContext
  ): Promise<string | undefined> {
    try {
      await this.scheduleEvery(THREAD_HISTORY_PRUNE_INTERVAL_SECONDS, "runThreadHistoryPrune");
      const replyBlock = `\n\n________________________________\nFrom: CAF-GPT\n\n${htmlToText(replyContent) || replyContent.trim()}`;

      return recordThreadTurn(
        this.sql.bind(this),
        parsedEmail,
        // Each side gets half the block cap so a long answer cannot push out the inbound email.
        replyBlock.slice(0, THREAD_HISTORY_MAX_CHARS / 2) +
          formatQuotedContent(parsedEmail).slice(0, THREAD_HISTORY_MAX_CHARS / 2),
        thread.threadId,
        outboundMessageId,
        Date.now()
      );
    } catch (error) {
      this.logger.warn("Thread history save failed", {
        ...logContext,
        ...getSafeErrorMetadata(error),
      });

      return undefined;
    }
  }

  /** Scheduled: prunes expired thread history, send times and inbound ids; cancels itself once none remain. */
  async runThreadHistoryPrune(_payload: undefined, schedule?: { id: string }): Promise<void> {
    const now = Date.now();

    const sql = this.sql.bind(this);

    const remaining =
      pruneThreadHistory(sql, now) + pruneSentTimes(sql, now) + pruneInboundLedger(sql, now);

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

  /**
   * Attempts one sender-only error reply through the same Resend thread, swallows every reply
   * failure, and reports the result. It is sent only when Resend authenticated the sender, the
   * sender is allowlisted, and the email names no other Reply-To (Resend replies to Reply-To),
   * so it can never become backscatter to a forged or third-party address.
   */
  private async handleProcessingError(
    error: ProcessingError,
    client: ResendClient,
    task: ResendInboundTask,
    parsedEmail: ParsedEmailData,
    senderAuthenticated: boolean,
    config: AppConfig,
    logContext: InboundLogContext
  ): Promise<ErrorReplyStatus> {
    const envelopeSender = normalizeEmailAddress(parsedEmail.envelopeFrom);

    if (!senderAuthenticated) {
      this.logger.warn("Skipping error reply to unauthenticated sender", logContext);

      return "skipped_unauthenticated";
    }

    if (!isAuthorizedEmailAddress(envelopeSender, config.authorization)) {
      this.logger.warn(
        "Skipping error reply to unauthorized or malformed envelope sender",
        logContext
      );

      return "skipped_unauthorized";
    }

    const replyTo = [...task.replyTo, ...parsedEmail.replyTo].map((address) =>
      normalizeEmailAddress(address)
    );

    if (replyTo.some((address) => address !== envelopeSender)) {
      this.logger.warn("Skipping error reply because Reply-To names another address", logContext);

      return "skipped_reply_to";
    }

    try {
      await client.replyToThreadEmail(
        task.inboxId,
        task.threadId,
        task.emailId,
        {
          subject: "Error Processing Email",
          text: this.getErrorResponseMessage(error),
          reply_all: false,
        },
        `caf-gpt-error/${task.emailId}`
      );
      this.logger.info("Sender-only error reply sent", logContext);

      return "sent";
    } catch (replyError) {
      this.logger.error("Failed to send error reply", {
        ...logContext,
        ...getSafeErrorMetadata(replyError),
        ...getResendErrorFields(replyError),
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

  /** Converts a caught value into the error contract used for sender-facing templates. */
  private parseProcessingError<ErrorValue>(error: ErrorValue): ProcessingError {
    return error instanceof Error ? error : String(error);
  }
}
