/**
 * src/agents/utils/ToolReadingAgent.ts
 *
 * Base class for one-call agents that answer by reading indexed documents through a bounded
 * read_file tool (the small model picks documents from the full index in its prompt)
 *
 * Top-level declarations:
 * - ToolReadLimits: Limits enforced by the read_file tool
 * - ToolReadingAgentConfig: Configuration for tool-reading agent behavior (includes tag callback)
 * - ToolReadingAgentDependencies: Injectable BaseAgent dependencies
 * - ToolReadingAgent: Config-driven agent that runs one read_file tool loop and answers from what it read
 */

import { type StepResult, stepCountIs, type ToolSet, tool } from "ai";
import { z } from "zod";
import type { AppConfig } from "../../config";
import { AgentValidationError, BaseAppError, StorageValidationError } from "../../errors";
import {
  getAiUpstreamCode,
  type ToolReadDiagnostics,
  type ToolReadReason,
  toLoggableToolReadDiagnostics,
} from "../../email/utils/LogRedaction";
import { getSafeErrorMetadata } from "../../Logger";
import type { ResearchRequest } from "../../types";
import type { BaseAgentDependencies } from "./BaseAgent";
import { BaseAgent, createProviderOptions } from "./BaseAgent";
import { parseManifestIndex } from "./ManifestParser";

const READ_FILE_TOOL_NAME = "read_file";

/** Limits for read_file attempts, successful reads, and correctable bad calls. */
export interface ToolReadLimits {
  /** Most read_file calls the model may make (good and bad). */
  totalCalls: number;
  /** Most documents the model may successfully read. */
  successfulReads: number;
  /** Bad calls (unknown Id, read limit reached) returned to the model before the run fails. */
  badCalls: number;
}

/** Configuration for one-call tool-reading agent behavior. */
export interface ToolReadingAgentConfig {
  /** R2 storage category (e.g., "doad", "qro") */
  category: string;
  /** Human-readable policy type for error messages (e.g., "DOAD policy", "QR&O policy") */
  policyType: string;
  /** Model config key in AppConfig.llm.models */
  modelKey: keyof AppConfig["llm"]["models"];
  /** Prompt name for the tool-reading agent */
  promptName: string;
  /** Prompt variable name that receives the full domain index table */
  indexVariableName: string;
  /** Limits enforced by read_file */
  readLimits: ToolReadLimits;
  /** Index filename under the category prefix (default index_v2.md) */
  indexFile?: string;
  /** Domain-specific XML tag formatter for a read Id and its document body */
  formatDocumentTag: (id: string, content: string) => string;
}

/** Injectable dependencies for ToolReadingAgent. */
export type ToolReadingAgentDependencies = Partial<BaseAgentDependencies>;

/** What read_file returns to the model: a document, or a correctable error. */
interface ReadFileResult {
  ok: boolean;
  content: string;
}

/**
 * Stops the read_file loop once the latest step has a failed tool call, so a hard failure (budget
 * exhausted, storage error) reaches the caller after one step instead of being retried by the model.
 * @param options - AI SDK stop-condition input with the steps so far
 */
function stopOnReadToolError<Tools extends ToolSet>({
  steps,
}: {
  steps: Array<StepResult<Tools>>;
}): boolean {
  return steps.at(-1)?.content.some((part) => part.type === "tool-error") ?? false;
}

/** Config-driven indexed document agent: one model call with a bounded read_file tool. */
export class ToolReadingAgent extends BaseAgent {
  protected agentConfig: ToolReadingAgentConfig;

  constructor(
    env: Env,
    config: AppConfig,
    agentConfig: ToolReadingAgentConfig,
    dependencies: ToolReadingAgentDependencies = {}
  ) {
    super(env, config, dependencies);
    this.agentConfig = agentConfig;
  }

  async research(request: ResearchRequest): Promise<string> {
    const startTime = Date.now();
    // Counts and a fixed reason code only (never the question, Ids, titles, bodies, or model output).
    const diagnostics: ToolReadDiagnostics = {};

    try {
      this.logger.info(`Starting ${this.agentConfig.category}_foo tool-reading research`);

      if (!request.question || request.question.trim().length === 0) {
        diagnostics.readReason = "empty_question";

        throw new AgentValidationError("Empty research question provided");
      }

      // DocumentRetriever throws typed StorageNotFoundError for a missing or empty index.
      const indexContent = await this.getIndexContent();
      const index = parseManifestIndex(indexContent);
      diagnostics.indexRows = index.rows.length;
      diagnostics.skippedRows = index.skippedRows;

      if (index.rows.length === 0) {
        diagnostics.readReason = "index_no_rows";

        throw new StorageValidationError(
          `${this.agentConfig.policyType} index did not contain readable files`
        );
      }

      const fileById = new Map(index.rows.map((row) => [row.id, row.file]));

      const response = await this.runToolReadingCall(
        request.question,
        indexContent,
        fileById,
        diagnostics
      );

      diagnostics.readReason = "read_ok";

      this.logger.performance(`${this.agentConfig.category}_foo tool-reading research`, startTime, {
        questionLength: request.question.length,
        ...toLoggableToolReadDiagnostics(diagnostics),
      });

      return response;
    } catch (error) {
      const failureMetadata = {
        processingTime: Date.now() - startTime,
        questionLength: request.question?.length ?? 0,
        ...toLoggableToolReadDiagnostics(diagnostics),
        ...getSafeErrorMetadata(error),
      };

      const aiUpstreamCode = getAiUpstreamCode(error);

      if (aiUpstreamCode !== undefined) {
        Object.assign(failureMetadata, { aiUpstreamCode });
      }

      this.logger.error(
        `${this.agentConfig.category}_foo tool-reading research failed`,
        failureMetadata
      );
      throw error;
    }
  }

  /** Loads the category index table that the model picks documents from. */
  protected async getIndexContent(): Promise<string> {
    return this.docRetriever.getDocument(
      this.agentConfig.category,
      this.agentConfig.indexFile ?? "index_v2.md"
    );
  }

  /**
   * Runs the single read_file tool loop and returns the model's answer, or throws a typed error
   * with diagnostics.readReason set to the fixed failure code.
   * @param question - Research question from Prime Foo
   * @param indexContent - Full index table placed in the prompt
   * @param fileById - Allowlisted index Id to R2 file path
   * @param diagnostics - Mutable content-free counts and reason for the caller's log line
   */
  private async runToolReadingCall(
    question: string,
    indexContent: string,
    fileById: Map<string, string>,
    diagnostics: ToolReadDiagnostics
  ): Promise<string> {
    const { readLimits, policyType } = this.agentConfig;
    const modelConfig = this.config.llm.models[this.agentConfig.modelKey];

    const rendered = await this.promptManager.renderPrompt(this.agentConfig.promptName, {
      [this.agentConfig.indexVariableName]: indexContent,
      user_input: question,
    });

    const providerOptions = createProviderOptions(modelConfig.model);
    const maxSteps = readLimits.totalCalls + 1;

    let totalCalls = 0;
    let successfulReads = 0;
    let reservedReads = 0;
    let badCalls = 0;
    // First error a read_file execution threw; rethrown after generation so its type survives.
    let toolFailed = false;
    let toolFailure: unknown;
    let toolFailureReason: ToolReadReason = "tool_failed";

    const syncCounts = (): void => {
      diagnostics.totalCalls = totalCalls;
      diagnostics.successfulReads = successfulReads;
      diagnostics.badCalls = badCalls;
    };

    const fail = (reason: ToolReadReason, message: string): AgentValidationError => {
      diagnostics.readReason = reason;
      syncCounts();

      return new AgentValidationError(message);
    };

    // A bad call is returned to the model to correct; past the budget the run fails loudly.
    // The model-supplied file value is only echoed back to the model, never logged or thrown.
    const markBadCall = (message: string): ReadFileResult => {
      if (badCalls >= readLimits.badCalls) {
        toolFailureReason = "bad_call_budget_exhausted";

        throw new AgentValidationError(`${policyType} read_file correction budget exhausted`);
      }

      badCalls += 1;

      return {
        ok: false,
        content: `read_file error: ${message}. Choose a valid file from the provided index.`,
      };
    };

    const readFile = async (file: string): Promise<ReadFileResult> => {
      if (totalCalls >= readLimits.totalCalls) {
        toolFailureReason = "call_limit_exceeded";

        throw new AgentValidationError(`${policyType} read_file total call limit exceeded`);
      }

      totalCalls += 1;

      if (successfulReads + reservedReads >= readLimits.successfulReads) {
        return markBadCall("successful read limit already reached");
      }

      const filePath = fileById.get(file);

      if (filePath === undefined) {
        return markBadCall(`"${file}" is not in the provided index`);
      }

      reservedReads += 1;

      try {
        const doc = await this.docRetriever.getDocument(this.agentConfig.category, filePath);
        successfulReads += 1;
        this.logger.info(`${policyType} document read through tool`, {
          ...toLoggableToolReadDiagnostics({ successfulReads, totalCalls }),
        });

        return { ok: true, content: this.agentConfig.formatDocumentTag(file, doc) };
      } finally {
        reservedReads -= 1;
      }
    };

    const generationOptions = {
      model: this.getCachedModel(modelConfig.model),
      system: rendered.system,
      prompt: rendered.user,
      temperature: modelConfig.temperature,
      maxOutputTokens: modelConfig.maxOutputTokens,
      stopWhen: [stepCountIs(maxSteps), stopOnReadToolError],
      tools: {
        [READ_FILE_TOOL_NAME]: tool({
          description:
            "Read one document from the provided domain index. The file must exactly match an indexed identifier.",
          inputSchema: z.object({
            file: z.string().min(1).describe("Exact indexed document identifier to read"),
          }),
          execute: async ({ file }) => {
            try {
              return await readFile(file);
            } catch (error) {
              if (!toolFailed) {
                toolFailed = true;
                toolFailure = error;
                diagnostics.readReason = toolFailureReason;
                syncCounts();
              }

              throw error;
            }
          },
        }),
      },
    };

    if (providerOptions) {
      Object.assign(generationOptions, { providerOptions });
    }

    const result = await this.dependencies.generateText(generationOptions);
    diagnostics.steps = result.steps?.length ?? 0;
    syncCounts();

    if (toolFailed) {
      diagnostics.readReason = toolFailureReason;

      // Typed app errors (storage, validation) pass through so the cause stays visible.
      if (toolFailure instanceof BaseAppError) throw toolFailure;

      throw new AgentValidationError(`${policyType} read_file tool failed`);
    }

    const steps = result.steps ?? [];

    if (steps.some((step) => step.content.some((part) => part.type === "tool-error"))) {
      // A tool-error without a thrown execute error means the model's tool input was rejected.
      throw fail("tool_input_invalid", `${policyType} read_file input was invalid`);
    }

    const answer = result.text?.trim() ?? "";
    const lastStep = steps.at(-1);
    const endedOnToolCall = lastStep?.content.some((part) => part.type === "tool-call") ?? false;

    if (answer.length === 0 && steps.length >= maxSteps && endedOnToolCall) {
      throw fail("step_limit_reached", `${policyType} read_file step limit reached before answer`);
    }

    if (successfulReads === 0) {
      throw fail(
        "no_successful_reads",
        `${policyType} model did not successfully read any documents`
      );
    }

    if (answer.length === 0) {
      throw fail("empty_answer", "AI SDK returned empty content");
    }

    this.logger.info(`${policyType} tool-reading call successful`, {
      ...toLoggableToolReadDiagnostics(diagnostics),
    });

    return result.text;
  }
}
