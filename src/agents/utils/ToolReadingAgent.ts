/**
 * src/agents/utils/ToolReadingAgent.ts
 *
 * Base class for one-call agents that answer from Clef-shortlisted, prefetched documents
 *
 * Top-level declarations:
 * - ToolReadingAgentConfig: Configuration for shortlist-prefetch agent behavior
 * - ToolReadingAgentDependencies: Injectable BaseAgent + Clef AI dependencies
 * - ToolReadingAgent: Base class that shortlists via Clef-flash, prefetches via DocumentRetriever, then answers once
 */

import type { AppConfig } from "../../config";
import { AgentValidationError } from "../../errors";
import { getSafeErrorMetadata } from "../../Logger";
import type { ResearchRequest } from "../../types";
import type { BaseAgentDependencies } from "./BaseAgent";
import { BaseAgent, createProviderOptions } from "./BaseAgent";
import {
  type ClefAiRunner,
  CLEF_SHORTLIST_MAX_PICKS,
  shortlistManifestFiles,
} from "./ClefDecision";
import { parseManifestRows } from "./ManifestParser";

/** Configuration for one-call shortlist-prefetch agent behavior. */
export interface ToolReadingAgentConfig {
  /** R2 storage category (e.g., "doad", "qro") */
  category: string;
  /** Human-readable policy type for error messages (e.g., "DOAD policy", "QR&O policy") */
  policyType: string;
  /** Model config key in AppConfig.llm.models */
  modelKey: keyof AppConfig["llm"]["models"];
  /** Prompt name for the answering agent */
  promptName: string;
  /** Prompt variable name that receives prefetched document XML */
  documentsVariableName: string;
  /** Maximum documents Clef may shortlist and prefetch */
  maxPrefetchDocuments: number;
}

/** Injectable dependencies for ToolReadingAgent, including an optional Clef AI runner. */
export interface ToolReadingAgentDependencies extends Partial<BaseAgentDependencies> {
  clefAi?: ClefAiRunner;
}

// Base class for indexed document agents using Clef shortlist + prefetch + one answer call.
export abstract class ToolReadingAgent extends BaseAgent {
  protected agentConfig: ToolReadingAgentConfig;
  private clefAiOverride?: ClefAiRunner;

  constructor(
    env: Env,
    config: AppConfig,
    agentConfig: ToolReadingAgentConfig,
    dependencies: ToolReadingAgentDependencies = {}
  ) {
    const { clefAi, ...baseDependencies } = dependencies;
    super(env, config, baseDependencies);
    this.agentConfig = agentConfig;
    this.clefAiOverride = clefAi;
  }

  async research(request: ResearchRequest): Promise<string> {
    const startTime = Date.now();

    try {
      this.logger.info(`Starting ${this.agentConfig.category}_foo shortlist-prefetch research`);

      if (!request.question || request.question.trim().length === 0) {
        throw new Error("Empty research question provided");
      }

      const indexContent = await this.getIndexContent();
      if (!indexContent || indexContent.trim().length === 0) {
        throw new Error(`${this.agentConfig.policyType} index not found`);
      }

      const rows = parseManifestRows(indexContent);
      if (rows.length === 0) {
        throw new Error(`${this.agentConfig.policyType} index did not contain readable files`);
      }

      const fileById = new Map(rows.map((row) => [row.id, row.file]));
      const maxPicks = Math.min(
        this.agentConfig.maxPrefetchDocuments,
        CLEF_SHORTLIST_MAX_PICKS,
        rows.length
      );

      const shortlist = await shortlistManifestFiles(this.getClefAi(), request.question, rows, {
        maxPicks,
      });

      if (shortlist.ids.length === 0 && shortlist.reason !== "clef_intentional_none") {
        throw new AgentValidationError(
          `${this.agentConfig.policyType} Clef shortlist failed: ${shortlist.reason}`
        );
      }

      const prefetchedParts: string[] = [];
      for (const id of shortlist.ids) {
        const filePath = fileById.get(id);
        if (filePath === undefined) {
          // Defense in depth: shortlistManifestFiles already allowlists; skip unknowns.
          continue;
        }
        const doc = await this.docRetriever.getDocument(this.agentConfig.category, filePath);
        prefetchedParts.push(this.formatDocumentTag(id, doc));
        this.logger.info(`${this.agentConfig.policyType} document prefetched`, {
          size: doc.length,
          prefetchedCount: prefetchedParts.length,
        });
      }

      const prefetchedDocuments =
        prefetchedParts.length > 0
          ? prefetchedParts.join("\n\n")
          : "(No indexed documents were selected for this question.)";

      const response = await this.runPrefetchAnswerCall(request.question, prefetchedDocuments);

      this.logger.performance(
        `${this.agentConfig.category}_foo shortlist-prefetch research`,
        startTime,
        {
          questionLength: request.question.length,
          shortlistCount: shortlist.ids.length,
          shortlistReason: shortlist.reason,
          prefetchedCount: prefetchedParts.length,
        }
      );

      return response;
    } catch (error) {
      this.logger.error(`${this.agentConfig.category}_foo shortlist-prefetch research failed`, {
        processingTime: Date.now() - startTime,
        questionLength: request.question?.length ?? 0,
        ...getSafeErrorMetadata(error),
      });
      throw error;
    }
  }

  /** Get the index/table content for document selection. */
  protected abstract getIndexContent(): Promise<string | null>;

  /** Format loaded document with XML-like tags. */
  protected abstract formatDocumentTag(file: string, content: string): string;

  /** Returns the injectable Clef runner, defaulting to Workers AI on env. */
  private getClefAi(): ClefAiRunner {
    if (this.clefAiOverride) {
      return this.clefAiOverride;
    }
    return {
      // SAFETY: Workers AI.run model/inputs are wider than ClefAiRunner; ClefDecision only sends clef-flash payloads.
      run: (model, inputs) => this.env.AI.run(model as never, inputs as never),
    };
  }

  private async runPrefetchAnswerCall(
    question: string,
    prefetchedDocuments: string
  ): Promise<string> {
    const modelConfig = this.config.llm.models[this.agentConfig.modelKey];
    const rendered = await this.promptManager.renderPrompt(this.agentConfig.promptName, {
      [this.agentConfig.documentsVariableName]: prefetchedDocuments,
      user_input: question,
    });
    const providerOptions = createProviderOptions(modelConfig.model);

    const generationOptions = {
      model: this.getCachedModel(modelConfig.model),
      system: rendered.system,
      prompt: rendered.user,
      temperature: modelConfig.temperature,
      maxOutputTokens: modelConfig.maxOutputTokens,
    };
    if (providerOptions) {
      Object.assign(generationOptions, { providerOptions });
    }
    const result = await this.dependencies.generateText(generationOptions);

    if (!result.text || result.text.trim().length === 0) {
      throw new AgentValidationError("AI SDK returned empty content");
    }

    this.logger.info(`${this.agentConfig.policyType} prefetch-answer call successful`);

    return result.text;
  }
}
