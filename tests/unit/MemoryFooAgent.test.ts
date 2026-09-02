/**
 * tests/unit/MemoryFooAgent.test.ts
 *
 * Unit tests for MemoryFooAgent - memory update functionality
 *
 * Tests:
 * - Memory update with new information
 * - Memory unchanged response handling
 * - Input validation
 * - Error handling
 * - Multi-step oversize repair loop
 */

import { generateText } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";
import { createMockEnv } from "../mocks";

import { MemoryFooAgent } from "../../src/agents/sub-agents/MemoryFooAgent";
import { createConfig } from "../../src/config";
import { MemoryUnchangedToolInputSchema, MemoryUpdateToolInputSchema } from "../../src/schemas";

type MemoryToolInput =
  | z.input<typeof MemoryUpdateToolInputSchema>
  | z.input<typeof MemoryUnchangedToolInputSchema>;

const mockGenerateText = vi.fn();
const MOCK_USAGE = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 20, text: 20, reasoning: undefined },
};

function parseMemoryToolInput(toolName: string, input: MemoryToolInput) {
  if (toolName === "update_memory") {
    return MemoryUpdateToolInputSchema.parse(input);
  }
  if (toolName === "leave_memory_unchanged") {
    return MemoryUnchangedToolInputSchema.parse(input);
  }
  throw new Error("Memory update model did not complete a recognized memory tool");
}

type MemoryToolExecute = (input: MemoryToolInput) => Promise<string>;

function setMockMemoryToolCall(toolName: string, input: MemoryToolInput = {}) {
  mockGenerateText.mockImplementationOnce(
    async (options: { tools: Record<string, { execute?: MemoryToolExecute }> }) => {
      const parsed = parseMemoryToolInput(toolName, input);
      const selected = options.tools[toolName];
      if (!selected?.execute) {
        throw new Error("Memory update model did not complete a recognized memory tool");
      }
      await selected.execute(parsed);
      return { text: "", toolCalls: [] };
    }
  );
}

function setMockLLMError(message: string) {
  mockGenerateText.mockRejectedValueOnce(new Error(message));
}

function toolCallResult(toolName: string, input: MemoryToolInput, toolCallId: string) {
  return {
    warnings: [],
    usage: MOCK_USAGE,
    finishReason: { unified: "tool-calls" as const, raw: undefined },
    content: [
      {
        type: "tool-call" as const,
        toolCallType: "function" as const,
        toolCallId,
        toolName,
        input: JSON.stringify(input),
      },
    ],
  };
}

function createRealLoopAgent(
  mockEnv: ReturnType<typeof createMockEnv>,
  model: MockLanguageModelV3
): MemoryFooAgent {
  const config = createConfig(mockEnv);
  return new MemoryFooAgent(mockEnv, config, {
    createModel: () => model,
    generateText,
  });
}

describe("MemoryFooAgent", () => {
  let agent: MemoryFooAgent;
  let mockEnv: ReturnType<typeof createMockEnv>;

  beforeEach(() => {
    mockGenerateText.mockReset();
    mockGenerateText.mockImplementation(
      async (options: { tools: Record<string, { execute?: MemoryToolExecute }> }) => {
        await options.tools.leave_memory_unchanged?.execute?.({});
        return { text: "", toolCalls: [] };
      }
    );

    mockEnv = createMockEnv();
    const config = createConfig(mockEnv);
    agent = new MemoryFooAgent(mockEnv, config, { generateText: mockGenerateText });
  });

  it("should return updated memory when LLM provides new content", async () => {
    const newMemory = `The user is a Corporal in an infantry trade. They frequently ask about leave policy and prefer concise answers.`;

    setMockMemoryToolCall("update_memory", { content: newMemory });

    const result = await agent.updateMemory(
      "",
      "How much annual leave do I get?",
      "As a CAF member, you are entitled to 20 days of annual leave per year."
    );

    expect(result.updated).toBe(true);
    expect(result.content).toBe(newMemory);
  });

  it("should return unchanged when LLM indicates no new information", async () => {
    setMockMemoryToolCall("leave_memory_unchanged");

    const result = await agent.updateMemory(
      "Existing memory content",
      "Thanks for the info!",
      "You're welcome! Let me know if you have other questions."
    );

    expect(result.updated).toBe(false);
    expect(result.content).toBeUndefined();
  });

  it("should request a required memory tool call", async () => {
    setMockMemoryToolCall("leave_memory_unchanged");

    const result = await agent.updateMemory("Existing memory", "Hello", "Hi there!");

    expect(result.updated).toBe(false);
    const lastCall = mockGenerateText.mock.calls.at(-1)?.[0];
    expect(lastCall?.toolChoice).toBe("required");
    expect(Object.keys(lastCall?.tools ?? {})).toEqual(["update_memory", "leave_memory_unchanged"]);
  });

  it("should disable parallel Responses tool calls for the memory decision", async () => {
    setMockMemoryToolCall("update_memory", { content: "New memory content" });

    const result = await agent.updateMemory("", "Question", "Answer");

    expect(result.updated).toBe(true);
    expect(result.content).toBe("New memory content");
    const lastCall = mockGenerateText.mock.calls.at(-1)?.[0];
    expect(lastCall?.providerOptions).toMatchObject({
      openai: {
        forceReasoning: true,
        reasoningEffort: "high",
        store: false,
        parallelToolCalls: false,
      },
    });
  });

  it("should reject a second terminal memory decision defensively", async () => {
    setMockMemoryToolCall("leave_memory_unchanged");

    await agent.updateMemory("Memory", "Question", "Answer");

    const tools = mockGenerateText.mock.calls.at(-1)?.[0]?.tools;
    await expect(tools.update_memory.execute({ content: "Replacement" })).rejects.toThrow(
      "already recorded"
    );
  });

  it("should reject empty user email", async () => {
    const result = await agent.updateMemory("Memory", "", "Reply");

    expect(result.updated).toBe(false);
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it("should reject whitespace-only email context", async () => {
    const result = await agent.updateMemory("Memory", "   \n\t  ", "Reply");

    expect(result.updated).toBe(false);
  });

  it("should reject empty agent reply", async () => {
    const result = await agent.updateMemory("Memory", "User email content", "");

    expect(result.updated).toBe(false);
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it("should handle LLM API errors gracefully", async () => {
    setMockLLMError("API Error");

    await expect(agent.updateMemory("Memory", "Question", "Answer")).rejects.toThrow("API Error");
  });

  it("should handle malformed LLM response gracefully", async () => {
    mockGenerateText.mockImplementationOnce(async () => ({ text: "", toolCalls: [] }));

    await expect(agent.updateMemory("Memory", "Question", "Answer")).rejects.toThrow(
      "recognized memory tool"
    );
  });

  it("should handle invalid update memory content gracefully", async () => {
    setMockMemoryToolCall("update_memory", { content: "" });

    await expect(agent.updateMemory("Memory", "Question", "Answer")).rejects.toThrow();
  });

  it("should handle multiline memory content", async () => {
    const multilineMemory = `Paragraph 1: The user is a Sergeant.

Paragraph 2: They frequently ask about leave policy.

Paragraph 3: Currently focused on deployment preparation.`;

    setMockMemoryToolCall("update_memory", { content: multilineMemory });

    const result = await agent.updateMemory("", "Question", "Answer");

    expect(result.updated).toBe(true);
    expect(result.content).toBe(multilineMemory);
  });

  it("should use empty memory placeholder for new users", async () => {
    setMockMemoryToolCall("leave_memory_unchanged");

    await agent.updateMemory("", "Question", "Answer");

    const calls = mockGenerateText.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const lastCall = calls[calls.length - 1][0];
    const capturedContent = (lastCall.system || "") + (lastCall.prompt || "");
    expect(capturedContent).toContain("No prior interaction history");
  });

  it("rejects memory longer than 8000 characters and accepts 8000", async () => {
    setMockMemoryToolCall("leave_memory_unchanged");

    await agent.updateMemory("Memory", "Question", "Answer");

    const tools = mockGenerateText.mock.calls.at(-1)?.[0]?.tools;
    await expect(tools.update_memory.execute({ content: "a".repeat(8001) })).rejects.toThrow(
      "8000"
    );
  });

  it("repairs an oversize tool error with an under-cap update on the next real SDK step", async () => {
    let step = 0;
    const model = new MockLanguageModelV3({
      doGenerate: async () => {
        step += 1;
        return step === 1
          ? toolCallResult("update_memory", { content: "a".repeat(8001) }, "oversize")
          : toolCallResult("update_memory", { content: "a".repeat(8000) }, "repaired");
      },
    });
    const realAgent = createRealLoopAgent(mockEnv, model);

    const result = await realAgent.updateMemory("Memory", "Question", "Answer");

    expect(result).toEqual({ updated: true, content: "a".repeat(8000) });
    expect(model.doGenerateCalls).toHaveLength(2);
  });

  it("can leave memory unchanged after an oversize tool error on the next real SDK step", async () => {
    let step = 0;
    const model = new MockLanguageModelV3({
      doGenerate: async () => {
        step += 1;
        return step === 1
          ? toolCallResult("update_memory", { content: "a".repeat(8001) }, "oversize")
          : toolCallResult("leave_memory_unchanged", {}, "unchanged");
      },
    });
    const realAgent = createRealLoopAgent(mockEnv, model);

    const result = await realAgent.updateMemory("Memory", "Question", "Answer");

    expect(result).toEqual({ updated: false });
    expect(model.doGenerateCalls).toHaveLength(2);
  });

  it("stops after three consecutive oversize tool errors", async () => {
    let step = 0;
    const model = new MockLanguageModelV3({
      doGenerate: async () => {
        step += 1;
        return toolCallResult(
          "update_memory",
          { content: "a".repeat(8001) },
          `oversize-${step}`
        );
      },
    });
    const realAgent = createRealLoopAgent(mockEnv, model);

    await expect(realAgent.updateMemory("Memory", "Question", "Answer")).rejects.toThrow(
      "recognized memory tool"
    );
    expect(model.doGenerateCalls).toHaveLength(3);
  });

  it("completes a valid first tool call in one real SDK step", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () =>
        toolCallResult("update_memory", { content: "Valid memory" }, "valid-first"),
    });
    const realAgent = createRealLoopAgent(mockEnv, model);

    const result = await realAgent.updateMemory("Memory", "Question", "Answer");

    expect(result).toEqual({ updated: true, content: "Valid memory" });
    expect(model.doGenerateCalls).toHaveLength(1);
  });
});
