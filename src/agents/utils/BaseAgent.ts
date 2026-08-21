/**
 * src/agents/utils/BaseAgent.ts
 *
 * Base agent with OpenAI Responses integration routed through Cloudflare AI Gateway
 *
 * Top-level declarations:
 * - BaseAgentDependencies: Injectable model and generation functions for BaseAgent workflows
 * - CreateModelDependencies: Injectable provider factories for model construction
 * - BaseAgent: Base agent with AI SDK integration and template-based prompts
 * - isOpenAIResponsesModel: Checks if a model uses the OpenAI Responses provider
 * - createModel: Creates an OpenAI Responses model routed through Cloudflare AI Gateway
 * - createProviderOptions: Creates model-specific provider options
 * - callLangChain: Plain-text model call used by one-call sub-agents
 */

import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { generateText } from "ai";
import { createGatewayFetch } from "workers-ai-provider/gateway";
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

// Injectable provider factories used to construct an OpenAI Responses model.
export interface CreateModelDependencies {
  createOpenAI: typeof createOpenAI;
  createGatewayFetch: typeof createGatewayFetch;
}

// Injectable AI SDK functions used by BaseAgent and its subclasses.
export interface BaseAgentDependencies {
  createModel: typeof createModel;
  generateText: typeof generateText;
}

const CLOUDFLARE_AI_GATEWAY = "caf-gpt";
const OPENAI_MODEL_PREFIX = "openai/";
const GPT_56_MODEL_PREFIX = "openai/gpt-5.6-";

const OPENAI_RESPONSES_OPTIONS = {
  openai: {
    forceReasoning: true,
    reasoningEffort: "high",
    store: false,
  },
} as const satisfies ModelProviderOptions;

// Checks whether a model uses the OpenAI Responses provider through AI Gateway.
function isOpenAIResponsesModel(model: string): boolean {
  return model.startsWith(GPT_56_MODEL_PREFIX);
}

// Creates model-specific provider options for AI SDK calls.
export function createProviderOptions(model: string): ModelProviderOptions | undefined {
  return isOpenAIResponsesModel(model) ? OPENAI_RESPONSES_OPTIONS : undefined;
}

// Creates an OpenAI Responses model whose native request is routed by the AI binding Gateway API.
export function createModel(
  env: Env,
  model: string,
  dependencies: CreateModelDependencies = { createOpenAI, createGatewayFetch }
): LanguageModel {
  const openai = dependencies.createOpenAI({
    apiKey: "unused",
    fetch: dependencies.createGatewayFetch({
      binding: env.AI,
      gateway: CLOUDFLARE_AI_GATEWAY,
    }),
  });
  const modelId = model.startsWith(OPENAI_MODEL_PREFIX)
    ? model.slice(OPENAI_MODEL_PREFIX.length)
    : model;
  return openai.responses(modelId);
}

export abstract class BaseAgent {
  protected logger: Logger;
  protected config: AppConfig;
  protected promptManager: PromptManager;
  protected docRetriever: DocumentRetriever;
  protected dependencies: BaseAgentDependencies;
  private modelCache: Map<string, LanguageModel> = new Map();

  constructor(
    protected env: Env,
    config: AppConfig,
    dependencies: Partial<BaseAgentDependencies> = {}
  ) {
    this.config = config;
    this.logger = Logger.getInstance();
    this.promptManager = new PromptManager(env.ASSETS);
    this.docRetriever = new DocumentRetriever(env.R2_BUCKET);
    this.dependencies = {
      createModel,
      generateText,
      ...dependencies,
    };
  }

  protected getCachedModel(model: string): LanguageModel {
    let cached = this.modelCache.get(model);
    if (!cached) {
      cached = this.dependencies.createModel(this.env, model);
      this.modelCache.set(model, cached);
      this.logger.debug("Created and cached new AI SDK model");
    }
    return cached;
  }

  // Plain-text model call used by one-call sub-agents
  protected async callLangChain(params: LLMCallParams): Promise<string> {
    try {
      this.logger.info("Calling OpenAI Responses via Cloudflare AI Gateway", {
        promptName: params.promptName,
      });

      const rendered = await this.promptManager.renderPrompt(params.promptName, params.variables);
      const model = this.getCachedModel(params.model);
      const providerOptions = createProviderOptions(params.model);
      const generationOptions = {
        model,
        system: rendered.system,
        prompt: rendered.user,
        temperature: params.temperature,
        maxOutputTokens: params.maxOutputTokens,
      };
      if (providerOptions) {
        Object.assign(generationOptions, { providerOptions });
      }
      const result = await this.dependencies.generateText(generationOptions);

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
}
