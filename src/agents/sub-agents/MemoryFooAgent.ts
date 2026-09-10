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

import { stepCountIs, tool } from "ai";
import { getSafeErrorMetadata } from "../../Logger";
import { MemoryUnchangedToolInputSchema, MemoryUpdateToolInputSchema } from "../../schemas";
import { MEMORY_MAX_CONTENT_LENGTH } from "../memoryPolicy";
import { BaseAgent, createProviderOptions } from "../utils/BaseAgent";

const UPDATE_MEMORY_TOOL = "update_memory";
const LEAVE_MEMORY_UNCHANGED_TOOL = "leave_memory_unchanged";
const MEMORY_UPDATE_MAX_STEPS = 3;

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
      const memoryProviderOptions = providerOptions
        ? {
            ...providerOptions,
            openai: {
              ...providerOptions.openai,
              parallelToolCalls: false,
            },
          }
        : undefined;

      let recorded: MemoryUpdateResult | undefined;
      let extraDecision = false;
      const assertDecisionNotRecorded = () => {
        if (recorded !== undefined) {
          extraDecision = true;
          throw new Error("Memory decision already recorded");
        }
      };

      const generationOptions = {
        model: this.getCachedModel(modelConfig.model),
        system: rendered.system,
        prompt: rendered.user,
        temperature: modelConfig.temperature,
        maxOutputTokens: modelConfig.maxOutputTokens,
        stopWhen: [stepCountIs(MEMORY_UPDATE_MAX_STEPS), () => recorded !== undefined],
        tools: {
          [UPDATE_MEMORY_TOOL]: tool({
            description:
              "Update the user's memory when the exchange contains new information worth remembering.",
            inputSchema: MemoryUpdateToolInputSchema,
            execute: async ({ content }: { content: string }) => {
              assertDecisionNotRecorded();
              if (content.length > MEMORY_MAX_CONTENT_LENGTH) {
                throw new Error(
                  `Memory content is ${content.length} characters; maximum is ${MEMORY_MAX_CONTENT_LENGTH}. Rewrite the full narrative shorter.`
                );
              }
              recorded = { updated: true, content };
              return "accepted";
            },
          }),
          [LEAVE_MEMORY_UNCHANGED_TOOL]: tool({
            description: "Leave the user's memory unchanged when there is nothing new to remember.",
            inputSchema: MemoryUnchangedToolInputSchema,
            execute: async () => {
              assertDecisionNotRecorded();
              recorded = { updated: false };
              return "unchanged";
            },
          }),
        },
        toolChoice: "required" as const,
      };
      if (memoryProviderOptions) {
        Object.assign(generationOptions, { providerOptions: memoryProviderOptions });
      }
      await this.dependencies.generateText(generationOptions);

      // AI SDK catches execute throws as tool-error parts and still resolves.
      if (extraDecision) {
        throw new Error("Memory decision already recorded");
      }
      if (!recorded) {
        throw new Error("Memory update model did not complete a recognized memory tool");
      }

      this.logger.performance("memory update analysis", startTime, {
        updated: recorded.updated,
        contentLength: recorded.content?.length,
      });

      return recorded;
    } catch (error) {
      this.logger.error("Memory update analysis failed", {
        processingTime: Date.now() - startTime,
        ...getSafeErrorMetadata(error),
      });
      throw error;
    }
  }
}
