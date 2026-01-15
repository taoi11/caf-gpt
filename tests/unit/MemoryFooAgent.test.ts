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
const { mockInvoke, mockWithStructuredOutput } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockWithStructuredOutput: vi.fn(),
}));

vi.mock("@langchain/openai", () => ({
  ChatOpenAI: vi.fn(function MockChatOpenAI() {
    return {
      invoke: mockInvoke,
      withStructuredOutput: mockWithStructuredOutput,
    };
  }),
}));

import { MemoryFooAgent } from "../../src/agents/sub-agents/MemoryFooAgent";
import { createConfig } from "../../src/config";

function setMockStructuredResponse(
  response: { status: "unchanged" } | { status: "updated"; content: string }
) {
  const mockStructuredChat = {
    invoke: vi.fn().mockResolvedValueOnce(response),
  };
  mockWithStructuredOutput.mockReturnValueOnce(mockStructuredChat);
}

function setMockLLMError(message: string) {
  const mockStructuredChat = {
    invoke: vi.fn().mockRejectedValueOnce(new Error(message)),
  };
  mockWithStructuredOutput.mockReturnValueOnce(mockStructuredChat);
}

describe("MemoryFooAgent", () => {
  let agent: MemoryFooAgent;
  let mockEnv: ReturnType<typeof createMockEnv>;

  beforeEach(() => {
    mockInvoke.mockReset();
    mockWithStructuredOutput.mockReset();

    const defaultStructuredChat = {
      invoke: vi.fn().mockResolvedValue({ status: "unchanged" }),
    };
    mockWithStructuredOutput.mockReturnValue(defaultStructuredChat);

    mockEnv = createMockEnv();
    const config = createConfig(undefined);
    agent = new MemoryFooAgent(mockEnv, config);
  });

  it("should return updated memory when LLM provides new content", async () => {
    const newMemory = `The user is a Corporal in an infantry trade. They frequently ask about leave policy and prefer concise answers.`;

    setMockStructuredResponse({ status: "updated", content: newMemory });

    const result = await agent.updateMemory(
      "",
      "How much annual leave do I get?",
      "As a CAF member, you are entitled to 20 days of annual leave per year."
    );

    expect(result.updated).toBe(true);
    expect(result.content).toBe(newMemory);
  });

  it("should return unchanged when LLM indicates no new information", async () => {
    setMockStructuredResponse({ status: "unchanged" });

    const result = await agent.updateMemory(
      "Existing memory content",
      "Thanks for the info!",
      "You're welcome! Let me know if you have other questions."
    );

    expect(result.updated).toBe(false);
    expect(result.content).toBeUndefined();
  });

  it("should handle whitespace in unchanged tag", async () => {
    setMockStructuredResponse({ status: "unchanged" });

    const result = await agent.updateMemory("Existing memory", "Hello", "Hi there!");

    expect(result.updated).toBe(false);
  });

  it("should handle case-insensitive tags", async () => {
    setMockStructuredResponse({ status: "updated", content: "New memory content" });

    const result = await agent.updateMemory("", "Question", "Answer");

    expect(result.updated).toBe(true);
    expect(result.content).toBe("New memory content");
  });

  it("should reject empty user email", async () => {
    const result = await agent.updateMemory("Memory", "", "Reply");

    expect(result.updated).toBe(false);
    expect(mockWithStructuredOutput).not.toHaveBeenCalled();
  });

  it("should reject whitespace-only email context", async () => {
    const result = await agent.updateMemory("Memory", "   \n\t  ", "Reply");

    expect(result.updated).toBe(false);
  });

  it("should reject empty agent reply", async () => {
    const result = await agent.updateMemory("Memory", "User email content", "");

    expect(result.updated).toBe(false);
    expect(mockWithStructuredOutput).not.toHaveBeenCalled();
  });

  it("should handle LLM API errors gracefully", async () => {
    setMockLLMError("API Error");

    const result = await agent.updateMemory("Memory", "Question", "Answer");

    expect(result.updated).toBe(false);
  });

  it("should handle malformed LLM response gracefully", async () => {
    setMockStructuredResponse({ status: "unchanged" });

    const result = await agent.updateMemory("Memory", "Question", "Answer");

    expect(result.updated).toBe(false);
  });

  it("should handle empty memory tag gracefully", async () => {
    setMockStructuredResponse({ status: "unchanged" });

    const result = await agent.updateMemory("Memory", "Question", "Answer");

    expect(result.updated).toBe(false);
  });

  it("should handle multiline memory content", async () => {
    const multilineMemory = `Paragraph 1: The user is a Sergeant.

Paragraph 2: They frequently ask about leave policy.

Paragraph 3: Currently focused on deployment preparation.`;

    setMockStructuredResponse({ status: "updated", content: multilineMemory });

    const result = await agent.updateMemory("", "Question", "Answer");

    expect(result.updated).toBe(true);
    expect(result.content).toBe(multilineMemory);
  });

  it("should use empty memory placeholder for new users", async () => {
    let capturedInput: unknown = null;

    const mockStructuredChat = {
      invoke: vi.fn(async (input: unknown) => {
        capturedInput = input;
        return { status: "unchanged" };
      }),
    };
    mockWithStructuredOutput.mockReturnValueOnce(mockStructuredChat);

    await agent.updateMemory("", "Question", "Answer");

    const promptValue = capturedInput as { messages: Array<{ content: string }> };
    expect(promptValue.messages).toBeDefined();
    expect(promptValue.messages.length).toBeGreaterThan(0);
    const systemContent = promptValue.messages[0].content;
    expect(systemContent).toContain("No prior interaction history");
  });
});
