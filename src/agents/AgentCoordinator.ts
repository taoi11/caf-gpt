/**
 * src/agents/AgentCoordinator.ts
 *
 * Agent coordinator for prime_foo using LangChain createAgent
 *
 * Top-level declarations:
 * - AgentCoordinator: Coordinates prime_foo processing using LangChain tools and agents
 */

import { createAgent } from "langchain";
import type { AppConfig } from "../config";
import { formatError, Logger } from "../Logger";
import type { AgentResponse } from "../types";
import { iterationTrackerMiddleware, resetToolCallCount } from "./middleware";
import { DoadFooAgent, LeaveFooAgent, PaceFooAgent, QroFooAgent } from "./sub-agents";
import { createFeedbackNoteTool, createResearchTools } from "./tools";
import { createModel } from "./utils/BaseAgent";
import { PromptManager } from "./utils/PromptManager";

export class AgentCoordinator {
  private logger: Logger;
  private promptManager: PromptManager;
  private agent: ReturnType<typeof createAgent>;

  private constructor(agent: ReturnType<typeof createAgent>, promptManager: PromptManager) {
    this.logger = Logger.getInstance();
    this.promptManager = promptManager;
    this.agent = agent;
  }

  static async create(env: Env, config: AppConfig): Promise<AgentCoordinator> {
    const promptManager = new PromptManager(env.ASSETS);

    const leaveFooAgent = new LeaveFooAgent(env, config);
    const paceFooAgent = new PaceFooAgent(env, config);
    const doadFooAgent = new DoadFooAgent(env, config);
    const qroFooAgent = new QroFooAgent(env, config);

    const researchTools = createResearchTools(leaveFooAgent, doadFooAgent, qroFooAgent);
    const feedbackNoteTool = createFeedbackNoteTool(paceFooAgent);

    const model = await createModel(
      env,
      config.llm.models.primeFoo.model,
      config.llm.models.primeFoo.temperature
    );

    const agent = createAgent({
      model,
      tools: [...researchTools, feedbackNoteTool],
      middleware: [iterationTrackerMiddleware],
    });

    return new AgentCoordinator(agent, promptManager);
  }

  async processWithPrimeFoo(context: string, memory?: string): Promise<AgentResponse> {
    const startTime = Date.now();

    try {
      this.logger.info("Starting prime_foo processing with createAgent");

      if (!context || context.trim().length === 0) {
        this.logger.warn("Empty context provided to prime_foo");
        return { content: "", shouldRespond: false };
      }

      resetToolCallCount();

      let systemPrompt = await this.promptManager.getPrompt("prime_foo");

      // Inject memory into system prompt if available
      if (memory && memory.trim().length > 0) {
        systemPrompt = `${systemPrompt}

<memory>
${memory}
</memory>`;
      }

      const result = await this.agent.invoke(
        {
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Email context:\n\n${context}` },
          ],
        },
        {
          recursionLimit: 10,
        }
      );

      const lastMessage = result.messages[result.messages.length - 1];
      const content = lastMessage.text;

      const signature =
        "\n\nCAF-GPT\n[Source Code](https://github.com/taoi11/caf-gpt)\nHow to use CAF-GPT: [Documentation](https://caf-gpt.com)";
      const finalContent = content ? content + signature : "";

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

      return {
        content:
          "Thank you for your email. I encountered a technical issue while processing your request. Please try again later or contact my creator at dude@caf-gpt.com directly.\n\nRegards,\nCAF-GPT",
        shouldRespond: true,
      };
    }
  }
}
