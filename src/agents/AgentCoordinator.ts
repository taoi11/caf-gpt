/**
 * src/agents/AgentCoordinator.ts
 *
 * Agent coordinator for prime_foo using AI SDK built-in tool orchestration
 *
 * Top-level declarations:
 * - AgentCoordinator: Coordinates prime_foo processing with built-in AI SDK tools
 */

import { generateText, tool } from "ai";
import { z } from "zod";
import type { AppConfig } from "../config";
import { AgentCreditsExhaustedError, isOpenRouterCreditsErrorMessage } from "../errors";
import { formatError, Logger } from "../Logger";
import type { AgentResponse } from "../types";
import { DoadFooAgent, LeaveFooAgent, PaceFooAgent, QroFooAgent } from "./sub-agents";
import { createModel } from "./utils/BaseAgent";
import { PromptManager } from "./utils/PromptManager";

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
    private paceFooAgent: PaceFooAgent
  ) {
    this.logger = Logger.getInstance();
    this.promptManager = promptManager;
  }

  static async create(env: Env, config: AppConfig): Promise<AgentCoordinator> {
    const promptManager = new PromptManager(env.ASSETS);
    return new AgentCoordinator(
      env,
      config,
      promptManager,
      new LeaveFooAgent(env, config),
      new DoadFooAgent(env, config),
      new QroFooAgent(env, config),
      new PaceFooAgent(env, config)
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

      const model = await createModel(this.env, this.config.llm.models.primeFoo.model);
      const result = await generateText({
        model,
        system: systemPrompt,
        prompt: `Email context:\n\n${context}`,
        temperature: this.config.llm.models.primeFoo.temperature,
        maxOutputTokens: this.config.llm.maxTokens,
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
              const results: string[] = [];

              if (leave_queries && leave_queries.length > 0) {
                results.push("=== Leave Policy Research ===\n");
                const answers = await Promise.all(
                  leave_queries.map(async (query, index) => {
                    const answer = await this.leaveFooAgent.research({ question: query });
                    return `Query ${index + 1}: "${query}"\nAnswer: ${answer}\n`;
                  })
                );
                results.push(answers.join("\n"));
              }

              if (doad_queries && doad_queries.length > 0) {
                results.push("=== DOAD Policy Research ===\n");
                const answers = await Promise.all(
                  doad_queries.map(async (query, index) => {
                    const answer = await this.doadFooAgent.research({ question: query });
                    return `Query ${index + 1}: "${query}"\nAnswer: ${answer}\n`;
                  })
                );
                results.push(answers.join("\n"));
              }

              if (qro_queries && qro_queries.length > 0) {
                results.push("=== QR&O Policy Research ===\n");
                const answers = await Promise.all(
                  qro_queries.map(async (query, index) => {
                    const answer = await this.qroFooAgent.research({ question: query });
                    return `Query ${index + 1}: "${query}"\nAnswer: ${answer}\n`;
                  })
                );
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
      });

      const signature = `
<div class="MsoNormal">
<br><br>
CAF-GPT<br>
Source Code:<br>
<pre><code>https://github.com/taoi11/caf-gpt</code></pre>
How to use CAF-GPT:<br>
<pre><code>https://caf-gpt.com</code></pre>
</div>`;
      const finalContent = result.text ? result.text + signature : "";

      this.logger.performance("prime_foo processing", startTime);

      return {
        content: finalContent,
        shouldRespond: finalContent.length > 0,
      };
    } catch (error) {
      this.logger.error("Prime_foo processing failed", {
        processingTime: Date.now() - startTime,
        ...formatError(error),
      });

      if (error instanceof AgentCreditsExhaustedError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      if (isOpenRouterCreditsErrorMessage(errorMessage)) {
        throw new AgentCreditsExhaustedError(`OpenRouter credits exhausted: ${errorMessage}`);
      }

      return {
        content:
          "Thank you for your email. I encountered a technical issue while processing your request. Please try again later or contact my creator at dude@caf-gpt.com directly.\n\nRegards,\nCAF-GPT",
        shouldRespond: true,
      };
    }
  }
}
