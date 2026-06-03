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

import { generateText, tool } from "ai";
import { formatError } from "../../Logger";
import { MemoryUnchangedToolInputSchema, MemoryUpdateToolInputSchema } from "../../schemas";
import { BaseAgent, createProviderOptions } from "../utils/BaseAgent";

const UPDATE_MEMORY_TOOL = "update_memory";
const LEAVE_MEMORY_UNCHANGED_TOOL = "leave_memory_unchanged";

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

      const modelConfig = this.config.llm.models.memoryFoo;
      const rendered = await this.promptManager.renderPrompt("memory_foo", {
        current_memory: memoryContext,
        user_input: emailExchange,
      });
      const providerOptions = createProviderOptions(modelConfig.model);

      const response = await generateText({
        model: this.getCachedModel(modelConfig.model),
        system: rendered.system,
        prompt: rendered.user,
        temperature: modelConfig.temperature,
        maxOutputTokens: modelConfig.maxOutputTokens,
        tools: {
          [UPDATE_MEMORY_TOOL]: tool({
            description:
              "Update the user's memory when the exchange contains new information worth remembering.",
            inputSchema: MemoryUpdateToolInputSchema,
          }),
          [LEAVE_MEMORY_UNCHANGED_TOOL]: tool({
            description: "Leave the user's memory unchanged when there is nothing new to remember.",
            inputSchema: MemoryUnchangedToolInputSchema,
          }),
        },
        toolChoice: "required",
        ...(providerOptions ? { providerOptions } : {}),
      });

      const memoryToolCall = response.toolCalls.find(
        (call) =>
          call.toolName === UPDATE_MEMORY_TOOL || call.toolName === LEAVE_MEMORY_UNCHANGED_TOOL
      );

      if (!memoryToolCall) {
        throw new Error("Memory update model did not call a recognized memory tool");
      }

      let result: MemoryUpdateResult;
      if (memoryToolCall.toolName === UPDATE_MEMORY_TOOL) {
        result = {
          updated: true,
          content: MemoryUpdateToolInputSchema.parse(memoryToolCall.input).content,
        };
      } else {
        MemoryUnchangedToolInputSchema.parse(memoryToolCall.input ?? {});
        result = { updated: false };
      }

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
