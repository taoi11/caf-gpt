/**
 * src/email/SimpleEmailHandler.ts
 *
 * Main email processing handler using Resend API
 * Handles replies with full CC support enabled
 *
 * Top-level declarations:
 * - SimpleEmailHandler: Primary email handler with Resend integration
 * - processEmail: Processes incoming email with validation, AI response generation, and reply sending
 * - sendReplyWithResend: Sends reply via Resend API with CC support
 * - handleProcessingError: Handles processing errors with recovery strategies
 * - shouldSendErrorResponse: Determines if error response should be sent
 * - sendErrorResponse: Sends error response email to user via Resend
 * - getErrorResponseMessage: Gets user-friendly error message
 * - triggerMemoryUpdate: Fire-and-forget memory update after successful email reply
 */

import { AgentCoordinator } from "../agents/AgentCoordinator";
import { MemoryFooAgent } from "../agents/sub-agents";
import type { AppConfig } from "../config";
import {
  AgentError,
  BaseAppError,
  EmailCompositionError,
  EmailError,
  EmailParsingError,
  EmailThreadingError,
  EmailValidationError,
  StorageError,
} from "../errors";
import { formatError, Logger } from "../Logger";
import { MemoryRepository } from "../storage/MemoryRepository";
import { EmailComposer, EmailThreadManager } from "./components";
import { HtmlEmailComposer } from "./components/HtmlEmailComposer";
import { ResendEmailSender } from "./ResendEmailSender";
import type { ParsedEmailData } from "./types";
import { normalizeEmailAddress } from "./utils/EmailNormalizer";
import { validateEmailContent, validateRecipients } from "./utils/EmailValidator";

// Global cache for AgentCoordinator instances to reduce cold starts
const agentCache = new Map<string, AgentCoordinator>();

export class SimpleEmailHandler {
  private readonly emailThreadManager: EmailThreadManager;
  private readonly emailComposer: EmailComposer;
  private readonly htmlEmailComposer: HtmlEmailComposer;
  private readonly emailSender: ResendEmailSender;
  private readonly config: AppConfig;
  private readonly logger: Logger;

  constructor(
    private env: Env,
    config: AppConfig,
    emailThreadManager?: EmailThreadManager,
    emailComposer?: EmailComposer,
    htmlEmailComposer?: HtmlEmailComposer,
    emailSender?: ResendEmailSender
  ) {
    this.config = config;
    this.logger = Logger.getInstance();

    this.emailThreadManager = emailThreadManager || new EmailThreadManager();
    this.emailComposer = emailComposer || new EmailComposer();
    this.htmlEmailComposer = htmlEmailComposer || new HtmlEmailComposer();
    this.emailSender =
      emailSender || new ResendEmailSender(env.RESEND_API_KEY, config.email.agentFromEmail);
  }

  async processEmail(parsedEmail: ParsedEmailData, ctx?: ExecutionContext): Promise<void> {
    try {
      this.logger.info("Processing email from sender", { from: parsedEmail.from });

      // 0. Check if email is from our own address (prevent loops)
      if (this.guardAgainstSelfLoop(parsedEmail)) {
        return;
      }

      // 1. Validate email content and recipients
      this.validateEmail(parsedEmail);

      // 2. Build full email context for AI
      const emailContext = this.buildEmailContext(parsedEmail);

      // 3. Fetch user memory (graceful degradation if DB unavailable)
      const { emailUsername, memory } = await this.fetchMemory(parsedEmail);

      // 4. Get AI response with memory context
      const response = await this.getAIResponse(emailContext, memory);

      // 5. Send reply if needed
      await this.sendReplyIfNeeded(parsedEmail, response, ctx, emailUsername, memory, emailContext);
    } catch (error) {
      this.logger.error("Email processing failed", {
        from: parsedEmail.from,
        ...formatError(error),
      });
      await this.handleProcessingError(error, parsedEmail);

      // Re-throw non-recoverable errors
      if (error instanceof EmailError && !error.recoverable) {
        throw error;
      } else if (!(error instanceof EmailError)) {
        throw error; // Re-throw unknown errors
      }
      // Recoverable errors are logged but not re-thrown
    }
  }

  // Check if email is from our own address to prevent loops
  private guardAgainstSelfLoop(parsedEmail: ParsedEmailData): boolean {
    if (!parsedEmail.from) {
      this.logger.warn("Email sender is missing, ignoring email to prevent processing errors");
      return true;
    }
    if (parsedEmail.from === this.config.email.agentFromEmail) {
      this.logger.info("Ignoring email from self", { from: parsedEmail.from });
      return true;
    }
    return false;
  }

  // Validate email content and recipients
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

  // Build full email context string for AI processing
  private buildEmailContext(parsedEmail: ParsedEmailData): string {
    return `Subject: ${parsedEmail.subject}
From: ${parsedEmail.from}
To: ${parsedEmail.to.join(", ")}${
      parsedEmail.cc && parsedEmail.cc.length > 0 ? `\nCC: ${parsedEmail.cc.join(", ")}` : ""
    }

${parsedEmail.body}`;
  }

  // Fetch user memory from database with graceful degradation
  private async fetchMemory(
    parsedEmail: ParsedEmailData
  ): Promise<{ emailUsername: string | null; memory: string }> {
    const normalizedFrom = normalizeEmailAddress(parsedEmail.from);
    const emailUsername = normalizedFrom?.includes("@") ? normalizedFrom.split("@", 1)[0] : null;

    if (!emailUsername) {
      this.logger.warn("Unable to derive email username from address; skipping memory lookup", {
        from: parsedEmail.from,
        normalizedFrom,
      });
      return { emailUsername: null, memory: "" };
    }

    let memory = "";
    try {
      if (this.env.HYPERDRIVE && emailUsername) {
        const repo = new MemoryRepository(this.env.HYPERDRIVE);
        memory = await repo.getUserMemory(emailUsername);
      }
    } catch (err) {
      this.logger.warn("Failed to fetch memory, continuing without it", {
        error: err instanceof Error ? err.message : String(err),
        emailUsername,
      });
    }

    return { emailUsername, memory };
  }

  // Get AI response using cached AgentCoordinator
  private async getAIResponse(
    emailContext: string,
    memory: string
  ): Promise<{ shouldRespond: boolean; content?: string }> {
    let agentCoordinator = agentCache.get("main");
    if (!agentCoordinator) {
      this.logger.info("Creating new AgentCoordinator instance");
      agentCoordinator = await AgentCoordinator.create(this.env, this.config);
      agentCache.set("main", agentCoordinator);
    }
    return await agentCoordinator.processWithPrimeFoo(emailContext, memory);
  }

  // Send reply if agent determined a response is needed
  private async sendReplyIfNeeded(
    parsedEmail: ParsedEmailData,
    response: { shouldRespond: boolean; content?: string },
    ctx: ExecutionContext | undefined,
    emailUsername: string | null,
    memory: string,
    emailContext: string
  ): Promise<void> {
    if (response.shouldRespond && response.content?.trim()) {
      await this.sendReplyWithResend(parsedEmail, response.content);

      // Fire-and-forget memory update after successful reply
      if (ctx && this.env.HYPERDRIVE && emailUsername) {
        this.triggerMemoryUpdate(ctx, emailUsername, memory, emailContext, response.content);
      }
    }
  }

  // Fire-and-forget memory update after successful email reply
  private triggerMemoryUpdate(
    ctx: ExecutionContext,
    emailUsername: string,
    currentMemory: string,
    emailContext: string,
    agentReply: string
  ): void {
    ctx.waitUntil(
      (async () => {
        try {
          const memoryAgent = new MemoryFooAgent(this.env, this.config);
          const result = await memoryAgent.updateMemory(currentMemory, emailContext, agentReply);

          if (result.updated && result.content) {
            const repo = new MemoryRepository(this.env.HYPERDRIVE);
            await repo.updateMemory(emailUsername, result.content);
            this.logger.info("User memory updated successfully", { emailUsername });
          } else {
            this.logger.info("User memory unchanged", { emailUsername });
          }
        } catch (err) {
          this.logger.error("Memory update failed", {
            emailUsername,
            ...formatError(err),
          });
        }
      })()
    );
  }

  // Send reply via Resend with full CC support
  private async sendReplyWithResend(parsedEmail: ParsedEmailData, content: string): Promise<void> {
    try {
      // 1. Generate threading headers using EmailThreadManager
      const threadingHeaders = this.emailThreadManager.buildThreadingHeaders(parsedEmail);

      // 2. Format quoted content using EmailComposer
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

      // 3. Build complete reply content with quoted text
      const fullContent = content.trim() + quotedContent;

      // 4. Generate HTML content
      const htmlContent = this.htmlEmailComposer.composeHtmlReply(parsedEmail, content);

      // 5. Send via Resend with full CC support
      await this.emailSender.sendReply(
        parsedEmail,
        fullContent,
        threadingHeaders,
        true,
        htmlContent
      );

      this.logger.info("Reply sent successfully via Resend", {
        to: parsedEmail.from,
        ccCount: parsedEmail.cc.length,
      });
    } catch (error) {
      this.logger.error("Failed to send reply via Resend", {
        to: parsedEmail.from,
        ...formatError(error),
      });
      throw new EmailCompositionError(
        `Reply sending failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Handle processing errors with recovery strategies
  private async handleProcessingError(error: unknown, parsedEmail: ParsedEmailData): Promise<void> {
    // Log error using polymorphism - all BaseAppError subclasses handled uniformly
    if (error instanceof BaseAppError) {
      this.logger.error(`${error.constructor.name}`, {
        code: error.code,
        error: error.message,
        from: parsedEmail.from,
      });

      if (!error.recoverable) {
        this.logger.info(`${error.constructor.name} is not recoverable, skipping error response`);
        return;
      }
    }

    // Determine if we should send an error response
    const shouldSendErrorResponse = this.shouldSendErrorResponse(error);

    if (shouldSendErrorResponse) {
      try {
        await this.sendErrorResponse(error, parsedEmail);
      } catch (replyError) {
        this.logger.error("Failed to send error reply", {
          error: replyError instanceof Error ? replyError.message : String(replyError),
          from: parsedEmail.from,
        });
      }
    }
  }

  // Determine if error response should be sent
  private shouldSendErrorResponse(error: unknown): boolean {
    if (error instanceof BaseAppError && !error.recoverable) {
      return false; // Don't send response for non-recoverable errors
    }

    const errorMessage = error instanceof Error ? error.message : String(error);

    // Skip error response for specific conditions
    const skipConditions = ["already been replied to", "rcpt to is different"];

    return !skipConditions.some((condition) => errorMessage.includes(condition));
  }

  // Send error response email to user via Resend
  private async sendErrorResponse(error: unknown, parsedEmail: ParsedEmailData): Promise<void> {
    try {
      const errorMessage = this.getErrorResponseMessage(error);

      await this.emailSender.sendErrorResponse(parsedEmail.from, errorMessage);

      this.logger.info("Error reply sent successfully via Resend", { to: parsedEmail.from });
    } catch (replyError) {
      this.logger.error("Failed to send error reply via Resend", {
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

  // Get user-friendly error message
  private getErrorResponseMessage(error: unknown): string {
    if (error instanceof EmailParsingError) {
      return "Sorry, I had trouble reading your email. Please try sending it again or contact support if the problem persists.";
    }

    if (error instanceof EmailThreadingError) {
      return "Sorry, I encountered an issue with email threading. Your message was received but the reply formatting may be affected.";
    }

    if (error instanceof EmailCompositionError) {
      return "Sorry, I had trouble composing a response to your email. Please try again or contact support.";
    }

    if (error instanceof EmailValidationError) {
      return "Sorry, there was an issue with your email format or content. Please check your email and try again.";
    }

    // Agent errors
    if (error instanceof AgentError) {
      return "Sorry, I encountered an issue processing your request with our AI system. Please try again in a moment.";
    }

    // Storage errors
    if (error instanceof StorageError) {
      return "Sorry, I encountered a temporary issue accessing our systems. Please try again in a moment.";
    }

    // Generic error message for unknown errors
    return "Sorry, I encountered an error processing your email. Please try again.";
  }
}
