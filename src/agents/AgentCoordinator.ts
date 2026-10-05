/**
 * src/agents/AgentCoordinator.ts
 *
 * Agent coordinator for prime_foo using AI SDK built-in tool orchestration
 *
 * Top-level declarations:
 * - AgentCoordinatorDependencies: Injectable model and generation functions for Prime Foo
 * - PrimeFooStepFinishEvent: Minimal step metadata consumed by circuit-breaker logging
 * - AgentCoordinator: Coordinates prime_foo processing with built-in AI SDK tools and a circuit breaker (maxSteps: 3)
 */

import { APICallError, generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import type { AppConfig } from "../config";
import { AgentValidationError } from "../errors";
import { getSafeErrorMetadata, Logger } from "../Logger";
import type { AgentResponse } from "../types";
import { DoadFooAgent, LeaveFooAgent, PaceFooAgent, QroFooAgent } from "./sub-agents";
import { createModel, createProviderOptions } from "./utils/BaseAgent";
import { PromptManager } from "./utils/PromptManager";

interface PrimeFooStepFinishEvent {
  stepNumber: number;
  toolCalls: readonly object[];
}

// Injectable AI SDK functions used by the Prime Foo coordinator.
export interface AgentCoordinatorDependencies {
  createModel: typeof createModel;
  generateText: typeof generateText;
}

export class AgentCoordinator {
  private logger: Logger;
  private promptManager: PromptManager;

  private constructor(
    private env: Env,
    private config: AppConfig,
    promptManager: PromptManager,
    private leaveFooAgent: LeaveFooAgent,
    private doadFooAgent: DoadFooAgent,
    private qroFooAgent: QroFooAgent,
    private paceFooAgent: PaceFooAgent,
    private dependencies: AgentCoordinatorDependencies
  ) {
    this.logger = Logger.getInstance();
    this.promptManager = promptManager;
  }

  static async create(
    env: Env,
    config: AppConfig,
    dependencies: Partial<AgentCoordinatorDependencies> = {}
  ): Promise<AgentCoordinator> {
    const promptManager = new PromptManager(env.ASSETS);
    return new AgentCoordinator(
      env,
      config,
      promptManager,
      new LeaveFooAgent(env, config),
      new DoadFooAgent(env, config),
      new QroFooAgent(env, config),
      new PaceFooAgent(env, config),
      { createModel, generateText, ...dependencies }
    );
  }

  async processWithPrimeFoo(context: string, memory?: string): Promise<AgentResponse> {
    const startTime = Date.now();

    try {
      this.logger.info("Starting prime_foo processing with AI SDK tools");

      if (!context || context.trim().length === 0) {
        this.logger.warn("Empty context provided to prime_foo");
        return { content: "", shouldRespond: false };
      }

      let systemPrompt = await this.promptManager.getPrompt("prime_foo");
      if (memory && memory.trim().length > 0) {
        systemPrompt = `${systemPrompt}\n\n<memory>\n${memory}\n</memory>`;
      }

      const modelConfig = this.config.llm.models.primeFoo;
      const model = this.dependencies.createModel(this.env, modelConfig.model);
      const providerOptions = createProviderOptions(modelConfig.model);
      const maxSteps = 3;
      const generationOptions = {
        model,
        system: systemPrompt,
        prompt: `Email context:\n\n${context}`,
        temperature: modelConfig.temperature,
        maxOutputTokens: modelConfig.maxOutputTokens,
        stopWhen: stepCountIs(maxSteps),
        onStepFinish: ({ stepNumber, toolCalls }: PrimeFooStepFinishEvent) => {
          if (toolCalls.length > 0) {
            this.logger.info("Tool call tracked", { stepNumber: stepNumber + 1, maxSteps });
            if (stepNumber + 1 >= maxSteps) {
              this.logger.warn("Circuit breaker: tool call limit reached", {
                stepNumber: stepNumber + 1,
                maxSteps,
              });
            }
          }
        },
        tools: {
          batch_research: tool({
            description:
              "Research policy questions across leave, DOAD, and QR&O domains. Max 3 questions per domain.",
            inputSchema: z
              .object({
                leave_queries: z.array(z.string()).min(1).max(3).optional(),
                doad_queries: z.array(z.string()).min(1).max(3).optional(),
                qro_queries: z.array(z.string()).min(1).max(3).optional(),
              })
              .refine(
                (data) =>
                  (data.leave_queries?.length ?? 0) > 0 ||
                  (data.doad_queries?.length ?? 0) > 0 ||
                  (data.qro_queries?.length ?? 0) > 0,
                { message: "At least one query array must be provided" }
              ),
            execute: async ({ leave_queries, doad_queries, qro_queries }) => {
              // ⚡ Bolt: Execute cross-domain research concurrently via one shared runner.
              const domains = [
                {
                  queries: leave_queries,
                  heading: "=== Leave Policy Research ===\n",
                  research: (question: string) => this.leaveFooAgent.research({ question }),
                },
                {
                  queries: doad_queries,
                  heading: "=== DOAD Policy Research ===\n",
                  research: (question: string) => this.doadFooAgent.research({ question }),
                },
                {
                  queries: qro_queries,
                  heading: "=== QR&O Policy Research ===\n",
                  research: (question: string) => this.qroFooAgent.research({ question }),
                },
              ] as const;

              const domainAnswers = await Promise.all(
                domains.map(({ queries, research }) =>
                  queries && queries.length > 0
                    ? Promise.all(
                        queries.map(async (query, index) => {
                          const answer = await research(query);
                          return `Query ${index + 1}: "${query}"\nAnswer: ${answer}\n`;
                        })
                      )
                    : Promise.resolve(null)
                )
              );

              const results: string[] = [];
              for (let i = 0; i < domains.length; i++) {
                const answers = domainAnswers[i];
                if (!answers) continue;
                results.push(domains[i].heading);
                results.push(answers.join("\n"));
              }

              return results.length > 0 ? results.join("\n") : "No research queries provided.";
            },
          }),
          generate_feedback_note: tool({
            description:
              "Generate a CAF PACE feedback note for a member when a feedback note request is received.",
            inputSchema: z.object({
              rank: z.enum(["cpl", "mcpl", "sgt", "wo"]),
              context: z.string(),
            }),
            execute: async ({ rank, context }) => this.paceFooAgent.generateNote(rank, context),
          }),
        },
      };
      if (providerOptions) {
        Object.assign(generationOptions, { providerOptions });
      }
      const result = await this.dependencies.generateText(generationOptions);

      if (result.steps.some((step) => step.content.some((part) => part.type === "tool-error"))) {
        throw new AgentValidationError("Prime_foo tool execution failed");
      }

      if (!result.text || result.text.trim().length === 0) {
        this.logger.info("Prime_foo chose not to respond");
        this.logger.performance("prime_foo processing", startTime);
        return { content: "", shouldRespond: false };
      }

      const signature = `
<div class="MsoNormal">
<br><br>
CAF-GPT<br>
Source Code:<br>
<pre><code>https://github.com/taoi11/caf-gpt</code></pre>
How to use CAF-GPT:<br>
<pre><code>https://caf-gpt.com</code></pre>
</div>`;
      const finalContent = result.text + signature;

      this.logger.performance("prime_foo processing", startTime);

      return {
        content: finalContent,
        shouldRespond: true,
      };
    } catch (error) {
      const errorMetadata = {
        processingTime: Date.now() - startTime,
        ...getSafeErrorMetadata(error),
      };
      if (APICallError.isInstance(error)) {
        if (error.statusCode !== undefined) {
          Object.assign(errorMetadata, { statusCode: error.statusCode });
        }
        Object.assign(errorMetadata, { isRetryable: error.isRetryable });
      }
      this.logger.error("Prime_foo processing failed", errorMetadata);
      throw error;
    }
  }
}
