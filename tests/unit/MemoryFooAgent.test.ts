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
 * - Response parsing
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockEnv } from "../mocks";

// Use vi.hoisted to define mock function BEFORE module imports
const { mockGenerateText } = vi.hoisted(() => ({
  mockGenerateText: vi.fn(),
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    generateText: mockGenerateText,
  };
});

import { MemoryFooAgent } from "../../src/agents/sub-agents/MemoryFooAgent";
import { createConfig } from "../../src/config";

function createToolCall(toolName: string, input: unknown) {
  return {
    type: "tool-call",
    toolCallId: "memory-tool-call",
    toolName,
    input,
  };
}

function setMockMemoryToolCall(toolName: string, input: unknown = {}) {
  mockGenerateText.mockResolvedValueOnce({
    text: "",
    toolCalls: [createToolCall(toolName, input)],
  });
}

function setMockLLMError(message: string) {
  mockGenerateText.mockRejectedValueOnce(new Error(message));
}

describe("MemoryFooAgent", () => {
  let agent: MemoryFooAgent;
  let mockEnv: ReturnType<typeof createMockEnv>;

  beforeEach(() => {
    mockGenerateText.mockReset();
    mockGenerateText.mockResolvedValue({
      text: "",
      toolCalls: [createToolCall("leave_memory_unchanged", {})],
    });

    mockEnv = createMockEnv();
    const config = createConfig(mockEnv);
    agent = new MemoryFooAgent(mockEnv, config);
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

  it("should pass high reasoning and no-store Responses options for the small model", async () => {
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
      },
    });
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
    mockGenerateText.mockResolvedValueOnce({
      text: "",
      toolCalls: [createToolCall("unknown_memory_tool", {})],
    });

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
    // Memory content goes into the system prompt via template variables
    const capturedContent = (lastCall.system || "") + (lastCall.prompt || "");
    expect(capturedContent).toContain("No prior interaction history");
  });
});
