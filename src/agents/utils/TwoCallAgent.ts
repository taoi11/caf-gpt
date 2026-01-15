/**
 * src/agents/utils/TwoCallAgent.ts
 *
 * Base class for two-call pattern agents (selector -> answer)
 *
 * Top-level declarations:
 * - TwoCallAgentConfig: Configuration for two-call agent behavior
 * - TwoCallAgent: Base class implementing selector -> loader -> answer pattern
 */

import type { z } from "zod";
import type { AppConfig } from "../../config";
import { formatError } from "../../Logger";
import type { ResearchRequest } from "../../types";
import { BaseAgent } from "./BaseAgent";

// Configuration for two-call agent behavior
export interface TwoCallAgentConfig {
  /** R2 storage category (e.g., "doad", "qro") */
  category: string;
  /** Human-readable policy type for error messages (e.g., "DOAD policy", "QR&O policy") */
  policyType: string;
  /** Model config key in AppConfig.llm.models */
  modelKey: keyof AppConfig["llm"]["models"];
  /** Prompt name for file selection */
  selectorPromptName: string;
  /** Prompt name for answer generation */
  answerPromptName: string;
}

// Base class for two-call pattern agents (selector -> loader -> answer)
export abstract class TwoCallAgent<TSelector> extends BaseAgent {
  protected agentConfig: TwoCallAgentConfig;

  constructor(env: Env, config: AppConfig, agentConfig: TwoCallAgentConfig) {
    super(env, config);
    this.agentConfig = agentConfig;
  }

  async research(request: ResearchRequest): Promise<string> {
    const startTime = Date.now();

    try {
      this.logger.info(`Starting ${this.agentConfig.category}_foo research`);

      if (!request.question || request.question.trim().length === 0) {
        throw new Error("Empty research question provided");
      }

      const selectedFiles = await this.selectFiles(request.question);

      if (!selectedFiles || selectedFiles.length === 0) {
        this.logger.warn(`No ${this.agentConfig.policyType} documents identified`);
        return `I couldn't identify relevant ${this.agentConfig.policyType} documents for this question.`;
      }

      this.logger.info(`${this.agentConfig.policyType} documents selected`, {
        files: selectedFiles,
        count: selectedFiles.length,
      });

      const content = await this.loadFiles(selectedFiles);

      if (!content) {
        this.logger.warn(`No ${this.agentConfig.policyType} content loaded`);
        return `No relevant ${this.agentConfig.policyType} files found for this question.`;
      }

      const response = await this.answerQuery(request.question, content);

      this.logger.performance(`${this.agentConfig.category}_foo research`, startTime, {
        question: request.question?.substring(0, 100),
        fileCount: selectedFiles.length,
      });

      return response;
    } catch (error) {
      return this.handleResearchError(
        `${this.agentConfig.category}_foo research`,
        startTime,
        error,
        this.agentConfig.policyType,
        { question: request.question?.substring(0, 100) }
      );
    }
  }

  /** Select relevant files using structured LLM call. Returns file identifiers. */
  protected abstract selectFiles(query: string): Promise<string[]>;

  /** Get the Zod schema for the selector response */
  protected abstract getSelectorSchema(): z.ZodType<TSelector>;

  /** Extract file list from parsed selector response */
  protected abstract extractFilesFromResponse(response: TSelector): string[];

  /** Get variables for selector prompt (must include user_input) */
  protected abstract getSelectorVariables(
    query: string,
    indexContent: string
  ): Record<string, string>;

  /** Get the index/table content for file selection (loaded from R2) */
  protected abstract getIndexContent(): Promise<string | null>;

  /** Convert file identifier to R2 path */
  protected abstract getFilePath(fileId: string): string;

  /** Format loaded document with XML-like tags */
  protected abstract formatDocumentTag(fileId: string, content: string): string;

  /** Common selector implementation - subclasses call this from selectFiles() */
  protected async runSelector(query: string): Promise<string[]> {
    try {
      const indexContent = await this.getIndexContent();

      if (!indexContent) {
        this.logger.warn(`${this.agentConfig.policyType} index not found`);
        return [];
      }

      const modelConfig = this.config.llm.models[this.agentConfig.modelKey];

      const response = await this.callLangChainStructured(
        {
          model: modelConfig.model,
          promptName: this.agentConfig.selectorPromptName,
          variables: this.getSelectorVariables(query, indexContent),
          temperature: modelConfig.temperature,
        },
        this.getSelectorSchema(),
        `${this.agentConfig.category}_selector`
      );

      return this.extractFilesFromResponse(response);
    } catch (error) {
      this.logger.error(`${this.agentConfig.policyType} file selection failed`, formatError(error));
      return [];
    }
  }

  protected async loadFiles(fileIds: string[]): Promise<string> {
    // Parallelize document loading for better performance
    const loadPromises = fileIds.map(async (fileId) => {
      const filePath = this.getFilePath(fileId);

      try {
        const doc = await this.docRetriever.getDocument(this.agentConfig.category, filePath);

        if (doc) {
          this.logger.info(`${this.agentConfig.policyType} document loaded`, {
            fileId,
            size: doc.length,
          });
          return this.formatDocumentTag(fileId, doc);
        } else {
          this.logger.warn(`${this.agentConfig.policyType} document not found`, {
            fileId,
            filePath,
          });
          return null;
        }
      } catch (error) {
        this.logger.error(`Error loading ${this.agentConfig.policyType} document`, {
          fileId,
          filePath,
          ...formatError(error),
        });
        return null;
      }
    });

    const loadedDocs = (await Promise.all(loadPromises)).filter(
      (doc): doc is string => doc !== null
    );

    return loadedDocs.join("\n\n");
  }

  /** Generate answer using loaded content */
  protected async answerQuery(query: string, content: string): Promise<string> {
    try {
      const modelConfig = this.config.llm.models[this.agentConfig.modelKey];

      const response = await this.callLangChain({
        model: modelConfig.model,
        promptName: this.agentConfig.answerPromptName,
        variables: {
          [`${this.agentConfig.category}_content`]: content,
          user_input: query,
        },
        temperature: modelConfig.temperature,
      });

      return response;
    } catch (error) {
      this.logger.error(
        `${this.agentConfig.policyType} answer generation failed`,
        formatError(error)
      );
      throw error;
    }
  }
}
