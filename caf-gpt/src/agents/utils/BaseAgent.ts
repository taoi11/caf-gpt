/**
 * src/agents/utils/BaseAgent.ts
 *
 * Base agent with LangChain LLM integration using ChatPromptTemplate
 * Routes requests through Cloudflare AI Gateway for analytics and monitoring
 *
 * Top-level declarations:
 * - BaseAgent: Base agent with LangChain integration and template-based prompts
 * - createModel: Creates ChatOpenAI model routed through CF AI Gateway
 * - callLangChain: Calls LLM using cached ChatPromptTemplate with variables
 * - callLangChainStructured: Calls LLM with structured output using Zod schema
 */

import { ChatOpenAI } from "@langchain/openai";
import type { z } from "zod";
import type { AppConfig } from "../../config";
import { AgentAPIError, AgentTimeoutError, AgentValidationError } from "../../errors";
import { formatError, Logger } from "../../Logger";
import { DocumentRetriever } from "../../storage/DocumentRetriever";
import { PromptManager } from "./PromptManager";

// AI Gateway name configured in Cloudflare dashboard
const AI_GATEWAY_NAME = "caf-gpt";

// Module-level gateway URL cache (shared across all agents in same request)
let gatewayUrlCache: string | undefined;
let gatewayUrlResolved = false;

// Resolve AI Gateway URL, caching result for the request lifecycle
async function getGatewayUrl(env: Env): Promise<string | undefined> {
  if (gatewayUrlResolved) return gatewayUrlCache;

  try {
    const gateway = env.AI.gateway(AI_GATEWAY_NAME);
    const url = await gateway.getUrl("openrouter");
    // CRITICAL: Must append /v1 - LangChain adds /chat/completions
    gatewayUrlCache = `${url}/v1`;
  } catch {
    gatewayUrlCache = undefined;
  }
  gatewayUrlResolved = true;
  return gatewayUrlCache;
}

interface LLMCallParams {
  model: string;
  promptName: string;
  variables: Record<string, string>;
  temperature: number;
}

// Create ChatOpenAI model routed through CF AI Gateway
export async function createModel(
  env: Env,
  model: string,
  temperature: number
): Promise<ChatOpenAI> {
  const gatewayUrl = await getGatewayUrl(env);
  const baseURL = gatewayUrl ?? "https://openrouter.ai/api/v1";

  const defaultHeaders: Record<string, string> = {
    "HTTP-Referer": "https://caf-gpt.com",
    "X-Title": "CAF-GPT",
  };

  // CRITICAL: cf-aig-authorization required when AI Gateway "Authenticated Gateway" is enabled
  if (gatewayUrl && env.CF_AIG_AUTH) {
    defaultHeaders["cf-aig-authorization"] = `Bearer ${env.CF_AIG_AUTH}`;
  }

  return new ChatOpenAI({
    model,
    temperature,
    apiKey: env.OPENROUTER_TOKEN,
    configuration: { baseURL, defaultHeaders },
    maxRetries: 2,
    timeout: 60000,
  });
}

// Base agent with OpenRouter integration and ChatPromptTemplate support
export abstract class BaseAgent {
  protected logger: Logger;
  protected config: AppConfig;
  protected promptManager: PromptManager;
  protected docRetriever: DocumentRetriever;
  private modelCache: Map<string, ChatOpenAI> = new Map();

  constructor(
    protected env: Env,
    config: AppConfig
  ) {
    this.config = config;
    this.logger = Logger.getInstance();
    this.promptManager = new PromptManager(env.ASSETS);
    this.docRetriever = new DocumentRetriever(env.R2_BUCKET);
  }

  // Get cached ChatOpenAI model instance
  private async getCachedModel(model: string, temperature: number): Promise<ChatOpenAI> {
    const cacheKey = `${model}-${temperature}`;
    let cached = this.modelCache.get(cacheKey);

    if (!cached) {
      cached = await createModel(this.env, model, temperature);
      this.modelCache.set(cacheKey, cached);
      this.logger.debug("Created and cached new ChatOpenAI model", { model, temperature });
    }

    return cached;
  }

  // Call LLM using cached ChatPromptTemplate with variables
  protected async callLangChain(params: LLMCallParams): Promise<string> {
    try {
      this.logger.info("Calling OpenRouter via LangChain", {
        model: params.model,
        promptName: params.promptName,
      });

      const template = await this.promptManager.getTemplate(params.promptName);
      const messages = await template.invoke(params.variables);

      const chat = await this.getCachedModel(params.model, params.temperature);
      const response = await chat.invoke(messages);

      if (!response.content || String(response.content).trim() === "") {
        throw new AgentValidationError("LangChain returned empty content");
      }

      this.logger.info("LangChain call successful", {
        model: params.model,
        tokens: response.usage_metadata,
      });
      return String(response.content);
    } catch (error) {
      this.logger.error("LangChain call failed", {
        model: params.model,
        promptName: params.promptName,
        ...formatError(error),
      });

      if (error instanceof AgentValidationError) throw error;

      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes("timeout") || errorMessage.includes("timed out")) {
        throw new AgentTimeoutError(`LangChain call timed out: ${errorMessage}`);
      }

      throw new AgentAPIError(`LangChain API call failed: ${errorMessage}`);
    }
  }

  // Call LLM with structured output using Zod schema
  protected async callLangChainStructured<T>(
    params: LLMCallParams,
    schema: z.ZodType<T>,
    schemaName?: string
  ): Promise<T> {
    try {
      this.logger.info("Calling OpenRouter via LangChain with structured output", {
        model: params.model,
        promptName: params.promptName,
        schemaName,
      });

      const template = await this.promptManager.getTemplate(params.promptName);
      const messages = await template.invoke(params.variables);

      const chat = await this.getCachedModel(params.model, params.temperature);
      const structuredChat = chat.withStructuredOutput(schema, {
        method: "jsonSchema",
        strict: true,
        name: schemaName ?? "response",
      });

      const response = await structuredChat.invoke(messages);

      this.logger.info("LangChain structured call successful", {
        model: params.model,
        schemaName,
      });

      return response as T;
    } catch (error) {
      this.logger.error("LangChain structured call failed", {
        model: params.model,
        promptName: params.promptName,
        schemaName,
        ...formatError(error),
      });

      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes("validation") || errorMessage.includes("schema")) {
        throw new AgentValidationError(
          `LangChain structured output validation failed: ${errorMessage}`
        );
      }

      if (errorMessage.includes("timeout") || errorMessage.includes("timed out")) {
        throw new AgentTimeoutError(`LangChain structured call timed out: ${errorMessage}`);
      }

      throw new AgentAPIError(`LangChain structured API call failed: ${errorMessage}`);
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
      if (error.message.includes("AI Gateway") || error.message.includes("LangChain")) {
        return errorMessages.aiGateway;
      }
    }

    return errorMessages.generic;
  }

  // Convenience wrapper for research operations - delegates to handleAgentError
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
