/**
 * src/agents/utils/BaseAgent.ts
 *
 * Base agent with OpenAI Responses integration routed through Cloudflare AI Gateway
 *
 * Top-level declarations:
 * - BaseAgent: Base agent with AI SDK integration and template-based prompts
 * - isOpenAIResponsesModel: Checks if a model uses the OpenAI Responses provider
 * - createModel: Creates an OpenAI Responses model routed through Cloudflare AI Gateway
 * - createProviderOptions: Creates model-specific provider options
 * - callLangChain: Backward-compatible wrapper for plain text model calls
 * - callLangChainStructured: Backward-compatible wrapper for structured model calls
 */

import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { generateObject, generateText } from "ai";
import { createGatewayFetch } from "workers-ai-provider/gateway";
import type { z } from "zod";
import type { AppConfig } from "../../config";
import { AgentAPIError, AgentTimeoutError, AgentValidationError } from "../../errors";
import { getSafeErrorMetadata, Logger } from "../../Logger";
import { DocumentRetriever } from "../../storage/DocumentRetriever";
import { PromptManager } from "./PromptManager";

interface LLMCallParams {
  model: string;
  promptName: string;
  variables: Record<string, string>;
  temperature: number;
  maxOutputTokens: number;
}

type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;
type JsonObject = { [key: string]: JsonValue | undefined };
type ModelProviderOptions = Record<string, JsonObject>;

const CLOUDFLARE_AI_GATEWAY = "caf-gpt";
const OPENAI_MODEL_PREFIX = "openai/";
const GPT_56_MODEL_PREFIX = "openai/gpt-5.6-";

const OPENAI_RESPONSES_OPTIONS: ModelProviderOptions = {
  openai: {
    forceReasoning: true,
    reasoningEffort: "high",
  },
};

// Checks whether a model uses the OpenAI Responses provider through AI Gateway.
function isOpenAIResponsesModel(model: string): boolean {
  return model.startsWith(GPT_56_MODEL_PREFIX);
}

// Creates model-specific provider options for AI SDK calls.
export function createProviderOptions(model: string): ModelProviderOptions | undefined {
  return isOpenAIResponsesModel(model) ? OPENAI_RESPONSES_OPTIONS : undefined;
}

// Creates an OpenAI Responses model whose native request is routed by the AI binding Gateway API.
export function createModel(env: Env, model: string): LanguageModel {
  const openai = createOpenAI({
    apiKey: "unused",
    fetch: createGatewayFetch({
      binding: env.AI,
      gateway: CLOUDFLARE_AI_GATEWAY,
    }),
  });
  const modelId = model.startsWith(OPENAI_MODEL_PREFIX)
    ? model.slice(OPENAI_MODEL_PREFIX.length)
    : model;
  return openai.responses(modelId) as unknown as LanguageModel;
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

  protected getCachedModel(model: string): LanguageModel {
    let cached = this.modelCache.get(model);
    if (!cached) {
      cached = createModel(this.env, model);
      this.modelCache.set(model, cached);
      this.logger.debug("Created and cached new AI SDK model");
    }
    return cached;
  }

  // Backward-compatible wrapper for text generation
  protected async callLangChain(params: LLMCallParams): Promise<string> {
    try {
      this.logger.info("Calling OpenAI Responses via Cloudflare AI Gateway", {
        promptName: params.promptName,
      });

      const rendered = await this.promptManager.renderPrompt(params.promptName, params.variables);
      const model = this.getCachedModel(params.model);
      const providerOptions = createProviderOptions(params.model);
      const result = await generateText({
        model,
        system: rendered.system,
        prompt: rendered.user,
        temperature: params.temperature,
        maxOutputTokens: params.maxOutputTokens,
        ...(providerOptions ? { providerOptions } : {}),
      });

      if (!result.text || result.text.trim().length === 0) {
        throw new AgentValidationError("AI SDK returned empty content");
      }

      this.logger.info("AI SDK call successful");
      return result.text;
    } catch (error) {
      this.logger.error("AI SDK call failed", {
        promptName: params.promptName,
        ...getSafeErrorMetadata(error),
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
      this.logger.info(
        "Calling OpenAI Responses via Cloudflare AI Gateway with structured output",
        {
          promptName: params.promptName,
          schemaName,
        }
      );

      const rendered = await this.promptManager.renderPrompt(params.promptName, params.variables);
      const model = this.getCachedModel(params.model);
      const providerOptions = createProviderOptions(params.model);
      const result = await generateObject({
        model,
        schema,
        schemaName: schemaName ?? "response",
        system: rendered.system,
        prompt: rendered.user,
        temperature: params.temperature,
        maxOutputTokens: params.maxOutputTokens,
        ...(providerOptions ? { providerOptions } : {}),
      });

      this.logger.info("AI SDK structured call successful", {
        schemaName,
      });

      return result.object;
    } catch (error) {
      this.logger.error("AI SDK structured call failed", {
        promptName: params.promptName,
        schemaName,
        ...getSafeErrorMetadata(error),
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
      ...getSafeErrorMetadata(error),
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
