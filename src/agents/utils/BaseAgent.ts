/**
 * src/agents/utils/BaseAgent.ts
 *
 * Base agent with Cloudflare Workers AI integration via AI SDK
 *
 * Top-level declarations:
 * - BaseAgent: Base agent with AI SDK integration and template-based prompts
 * - createModel: Creates Workers AI model via workers-ai-provider binding
 * - callLangChain: Backward-compatible wrapper for plain text model calls
 * - callLangChainStructured: Backward-compatible wrapper for structured model calls
 */

import type { LanguageModel } from "ai";
import { generateObject, generateText } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import type { z } from "zod";
import type { AppConfig } from "../../config";
import {
  AgentAPIError,
  AgentTimeoutError,
  AgentValidationError,
} from "../../errors";
import { formatError, Logger } from "../../Logger";
import { DocumentRetriever } from "../../storage/DocumentRetriever";
import { PromptManager } from "./PromptManager";

interface LLMCallParams {
  model: string;
  promptName: string;
  variables: Record<string, string>;
  temperature: number;
  maxOutputTokens: number;
}

export function createModel(env: Env, model: string): LanguageModel {
  const workersai = createWorkersAI({ binding: env.AI, gateway: { id: "caf-gpt" } });
  // Cast needed since new CF models may not be in the provider's type map yet.
  return workersai(model as Parameters<typeof workersai>[0]) as unknown as LanguageModel;
}

export abstract class BaseAgent {
  protected logger: Logger;
  protected config: AppConfig;
  protected promptManager: PromptManager;
  protected docRetriever: DocumentRetriever;
  private modelCache: Map<string, LanguageModel> = new Map();

  constructor(
    protected env: Env,
    config: AppConfig
  ) {
    this.config = config;
    this.logger = Logger.getInstance();
    this.promptManager = new PromptManager(env.ASSETS);
    this.docRetriever = new DocumentRetriever(env.R2_BUCKET);
  }

  private getCachedModel(model: string): LanguageModel {
    let cached = this.modelCache.get(model);
    if (!cached) {
      cached = createModel(this.env, model);
      this.modelCache.set(model, cached);
      this.logger.debug("Created and cached new AI SDK model", { model });
    }
    return cached;
  }

  // Backward-compatible wrapper for text generation
  protected async callLangChain(params: LLMCallParams): Promise<string> {
    try {
      this.logger.info("Calling Workers AI via AI SDK", {
        model: params.model,
        promptName: params.promptName,
      });

      const rendered = await this.promptManager.renderPrompt(params.promptName, params.variables);
      const model = this.getCachedModel(params.model);
      const result = await generateText({
        model,
        system: rendered.system,
        prompt: rendered.user,
        temperature: params.temperature,
        maxOutputTokens: params.maxOutputTokens,
      });

      if (!result.text || result.text.trim().length === 0) {
        throw new AgentValidationError("AI SDK returned empty content");
      }

      this.logger.info("AI SDK call successful", { model: params.model });
      return result.text;
    } catch (error) {
      this.logger.error("AI SDK call failed", {
        model: params.model,
        promptName: params.promptName,
        ...formatError(error),
      });

      if (error instanceof AgentValidationError) throw error;

      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes("timeout") || errorMessage.includes("timed out")) {
        throw new AgentTimeoutError(`AI SDK call timed out: ${errorMessage}`);
      }

      throw new AgentAPIError(`AI SDK call failed: ${errorMessage}`);
    }
  }

  // Backward-compatible wrapper for structured generation
  protected async callLangChainStructured<T>(
    params: LLMCallParams,
    schema: z.ZodType<T>,
    schemaName?: string
  ): Promise<T> {
    try {
      this.logger.info("Calling Workers AI via AI SDK with structured output", {
        model: params.model,
        promptName: params.promptName,
        schemaName,
      });

      const rendered = await this.promptManager.renderPrompt(params.promptName, params.variables);
      const model = this.getCachedModel(params.model);
      const result = await generateObject({
        model,
        schema,
        schemaName: schemaName ?? "response",
        system: rendered.system,
        prompt: rendered.user,
        temperature: params.temperature,
        maxOutputTokens: params.maxOutputTokens,
      });

      this.logger.info("AI SDK structured call successful", {
        model: params.model,
        schemaName,
      });

      return result.object;
    } catch (error) {
      this.logger.error("AI SDK structured call failed", {
        model: params.model,
        promptName: params.promptName,
        schemaName,
        ...formatError(error),
      });

      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes("validation") || errorMessage.includes("schema")) {
        throw new AgentValidationError(
          `AI SDK structured output validation failed: ${errorMessage}`
        );
      }
      if (errorMessage.includes("timeout") || errorMessage.includes("timed out")) {
        throw new AgentTimeoutError(`AI SDK structured call timed out: ${errorMessage}`);
      }

      throw new AgentAPIError(`AI SDK structured API call failed: ${errorMessage}`);
    }
  }

  protected handleAgentError(
    operation: string,
    startTime: number,
    error: unknown,
    errorMessages: { timeout: string; aiGateway: string; generic: string },
    context?: Record<string, unknown>
  ): string {
    const processingTime = Date.now() - startTime;
    this.logger.error(`${operation} failed`, {
      processingTime,
      ...context,
      ...formatError(error),
    });

    if (error instanceof Error) {
      if (error.message.includes("timeout")) {
        return errorMessages.timeout;
      }
      if (error.message.includes("AI Gateway") || error.message.includes("AI SDK")) {
        return errorMessages.aiGateway;
      }
    }

    return errorMessages.generic;
  }

  protected handleResearchError(
    operation: string,
    startTime: number,
    error: unknown,
    policyType: string,
    context?: Record<string, unknown>
  ): string {
    return this.handleAgentError(
      operation,
      startTime,
      error,
      {
        timeout: `I encountered a timeout while accessing ${policyType} documents.`,
        aiGateway: `I encountered an issue with the AI service while researching your ${policyType} question.`,
        generic: `I encountered an error while researching your ${policyType} question.`,
      },
      context
    );
  }
}
