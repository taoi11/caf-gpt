/**
 * src/agents/sub-agents/MemoryFooAgent.ts
 *
 * Sub-agent for updating user memory after email exchanges
 *
 * Top-level declarations:
 * - MemoryUpdateResult: Result of memory update operation
 * - MemoryFooAgent: Updates user memory based on email exchanges
 * - updateMemory: Processes email exchange and returns updated memory or unchanged signal
 */

import { formatError } from "../../Logger";
import { MemoryResponseSchema } from "../../schemas";
import { BaseAgent } from "../utils/BaseAgent";

// Result of memory update operation
export interface MemoryUpdateResult {
  updated: boolean;
  content?: string;
}

// Updates user memory based on email exchanges
export class MemoryFooAgent extends BaseAgent {
  // Processes email exchange and returns updated memory or unchanged signal
  async updateMemory(
    currentMemory: string,
    emailContext: string,
    agentReply: string
  ): Promise<MemoryUpdateResult> {
    const startTime = Date.now();

    try {
      this.logger.info("Starting memory update analysis");

      if (!emailContext || emailContext.trim().length === 0) {
        this.logger.warn("Empty email context provided, skipping memory update");
        return { updated: false };
      }
      if (!agentReply || agentReply.trim().length === 0) {
        this.logger.warn("Empty agent reply provided, skipping memory update");
        return { updated: false };
      }

      const emailExchange = `<user_email>
${emailContext}
</user_email>

<agent_reply>
${agentReply}
</agent_reply>`;

      const memoryContext =
        currentMemory.trim().length > 0 ? currentMemory : "No prior interaction history.";

      const response = await this.callLangChainStructured(
        {
          model: this.config.llm.models.memoryFoo.model,
          promptName: "memory_foo",
          variables: {
            current_memory: memoryContext,
            user_input: emailExchange,
          },
          temperature: this.config.llm.models.memoryFoo.temperature,
        },
        MemoryResponseSchema,
        "memory_response"
      );

      const result: MemoryUpdateResult =
        response.status === "updated"
          ? { updated: true, content: response.content }
          : { updated: false };

      this.logger.performance("memory update analysis", startTime, {
        updated: result.updated,
        contentLength: result.content?.length,
      });

      return result;
    } catch (error) {
      this.logger.error("Memory update analysis failed", {
        processingTime: Date.now() - startTime,
        ...formatError(error),
      });

      return { updated: false };
    }
  }
}
