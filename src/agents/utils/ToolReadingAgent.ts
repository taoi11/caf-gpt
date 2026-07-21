/**
 * src/agents/utils/ToolReadingAgent.ts
 *
 * Base class for one-call agents that answer by reading validated documents through an AI SDK tool
 *
 * Top-level declarations:
 * - ToolReadingAgentConfig: Configuration for tool-reading agent behavior
 * - ToolReadLimits: Limits enforced by the read_file tool
 * - ToolReadingAgent: Base class implementing indexed, bounded document reads during generation
 */

import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import type { AppConfig } from "../../config";
import { AgentValidationError } from "../../errors";
import { getSafeErrorMetadata } from "../../Logger";
import type { ResearchRequest } from "../../types";
import { BaseAgent, createProviderOptions } from "./BaseAgent";

const READ_FILE_TOOL_NAME = "read_file";

// Limits for read_file tool attempts and successful reads.
export interface ToolReadLimits {
  totalCalls: number;
  successfulReads: number;
  badCalls: number;
}

// Configuration for one-call tool-reading agent behavior.
export interface ToolReadingAgentConfig {
  /** R2 storage category (e.g., "doad", "qro") */
  category: string;
  /** Human-readable policy type for error messages (e.g., "DOAD policy", "QR&O policy") */
  policyType: string;
  /** Model config key in AppConfig.llm.models */
  modelKey: keyof AppConfig["llm"]["models"];
  /** Prompt name for the tool-reading agent */
  promptName: string;
  /** Prompt variable name that receives the domain index */
  indexVariableName: string;
  /** Limits enforced by read_file */
  readLimits: ToolReadLimits;
}

interface ReadFileResult {
  ok: boolean;
  content: string;
}

// Base class for indexed document-reading agents using one AI SDK tool loop.
export abstract class ToolReadingAgent extends BaseAgent {
  protected agentConfig: ToolReadingAgentConfig;

  constructor(env: Env, config: AppConfig, agentConfig: ToolReadingAgentConfig) {
    super(env, config);
    this.agentConfig = agentConfig;
  }

  async research(request: ResearchRequest): Promise<string> {
    const startTime = Date.now();

    try {
      this.logger.info(`Starting ${this.agentConfig.category}_foo tool-reading research`);

      if (!request.question || request.question.trim().length === 0) {
        throw new Error("Empty research question provided");
      }

      const indexContent = await this.getIndexContent();
      if (!indexContent || indexContent.trim().length === 0) {
        throw new Error(`${this.agentConfig.policyType} index not found`);
      }

      const allowedFiles = this.getAllowedFiles(indexContent);
      if (allowedFiles.size === 0) {
        throw new Error(`${this.agentConfig.policyType} index did not contain readable files`);
      }

      const response = await this.runToolReadingCall(request.question, indexContent, allowedFiles);

      this.logger.performance(`${this.agentConfig.category}_foo tool-reading research`, startTime, {
        questionLength: request.question.length,
      });

      return response;
    } catch (error) {
      this.logger.error(`${this.agentConfig.category}_foo tool-reading research failed`, {
        processingTime: Date.now() - startTime,
        questionLength: request.question?.length ?? 0,
        ...getSafeErrorMetadata(error),
      });
      throw error;
    }
  }

  /** Get the index/table content for document selection. */
  protected abstract getIndexContent(): Promise<string | null>;

  /** Extract the exact file identifiers that read_file is allowed to read. */
  protected abstract getAllowedFiles(indexContent: string): Set<string>;

  /** Convert a validated file identifier to an R2 path. */
  protected abstract getFilePath(file: string): string;

  /** Format loaded document with XML-like tags. */
  protected abstract formatDocumentTag(file: string, content: string): string;

  private async runToolReadingCall(
    question: string,
    indexContent: string,
    allowedFiles: Set<string>
  ): Promise<string> {
    const modelConfig = this.config.llm.models[this.agentConfig.modelKey];
    const rendered = await this.promptManager.renderPrompt(this.agentConfig.promptName, {
      [this.agentConfig.indexVariableName]: indexContent,
      user_input: question,
    });
    const providerOptions = createProviderOptions(modelConfig.model);

    let totalCalls = 0;
    let successfulReads = 0;
    let reservedReads = 0;
    let badCalls = 0;

    const markBadCall = (message: string): ReadFileResult => {
      if (badCalls >= this.agentConfig.readLimits.badCalls) {
        throw new AgentValidationError(
          `${this.agentConfig.policyType} read_file correction budget exhausted: ${message}`
        );
      }
      badCalls += 1;
      return {
        ok: false,
        content: `read_file error: ${message}. Choose a valid file from the provided index.`,
      };
    };

    const result = await generateText({
      model: this.getCachedModel(modelConfig.model),
      system: rendered.system,
      prompt: rendered.user,
      temperature: modelConfig.temperature,
      maxOutputTokens: modelConfig.maxOutputTokens,
      stopWhen: stepCountIs(this.agentConfig.readLimits.totalCalls + 1),
      tools: {
        [READ_FILE_TOOL_NAME]: tool({
          description:
            "Read one document from the provided domain index. The file must exactly match an indexed identifier.",
          inputSchema: z.object({
            file: z.string().min(1).describe("Exact indexed document identifier to read"),
          }),
          execute: async ({ file }) => {
            if (totalCalls >= this.agentConfig.readLimits.totalCalls) {
              throw new AgentValidationError(
                `${this.agentConfig.policyType} read_file total call limit exceeded`
              );
            }
            totalCalls += 1;

            if (successfulReads + reservedReads >= this.agentConfig.readLimits.successfulReads) {
              return markBadCall("successful read limit already reached");
            }

            if (!allowedFiles.has(file)) {
              return markBadCall(`"${file}" is not in the provided index`);
            }

            reservedReads += 1;
            try {
              const doc = await this.docRetriever.getDocument(
                this.agentConfig.category,
                this.getFilePath(file)
              );
              successfulReads += 1;
              this.logger.info(`${this.agentConfig.policyType} document read through tool`, {
                size: doc.length,
                successfulReads,
              });
              return {
                ok: true,
                content: this.formatDocumentTag(file, doc),
              };
            } finally {
              reservedReads -= 1;
            }
          },
        }),
      },
      ...(providerOptions ? { providerOptions } : {}),
    });

    if (result.steps?.some((step) => step.content.some((part) => part.type === "tool-error"))) {
      throw new AgentValidationError(`${this.agentConfig.policyType} read_file hard limit failed`);
    }

    if (successfulReads === 0) {
      throw new AgentValidationError(
        `${this.agentConfig.policyType} model did not successfully read any documents`
      );
    }

    if (!result.text || result.text.trim().length === 0) {
      throw new AgentValidationError("AI SDK returned empty content");
    }

    this.logger.info(`${this.agentConfig.policyType} tool-reading call successful`, {
      totalCalls,
      successfulReads,
      badCalls,
    });

    return result.text;
  }
}
