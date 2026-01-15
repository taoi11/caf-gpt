/**
 * tests/unit/PaceFooAgent.test.ts
 *
 * Unit tests for PaceFooAgent - feedback note generation
 *
 * Tests:
 * - Feedback note generation with different ranks
 * - Document retrieval from R2
 * - Error handling and timeouts
 * - LLM integration
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockEnv } from "../mocks";
import type { MockR2Bucket } from "../mocks/cloudflare";

// Use vi.hoisted to define mock function BEFORE module imports
const { mockInvoke } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
}));

// Mock ChatOpenAI
vi.mock("@langchain/openai", () => ({
  ChatOpenAI: vi.fn(function MockChatOpenAI() {
    return {
      invoke: mockInvoke,
    };
  }),
}));

// Import modules AFTER mocks
import { PaceFooAgent } from "../../src/agents/sub-agents/PaceFooAgent";
import { createConfig } from "../../src/config";

function setMockLLMResponse(response: string) {
  mockInvoke.mockResolvedValueOnce({ content: response });
}

function setMockLLMError(message: string) {
  mockInvoke.mockRejectedValueOnce(new Error(message));
}

interface ChatPromptValue {
  messages?: Array<{ content: string }>;
}

function captureMockMessages() {
  let capturedInput: unknown = null;

  mockInvoke.mockImplementation(async (input: unknown) => {
    capturedInput = input;
    return { content: "Note" };
  });

  return () => {
    if (!capturedInput) return null;
    const promptValue = capturedInput as ChatPromptValue;
    return promptValue.messages ?? null;
  };
}

describe("PaceFooAgent", () => {
  let agent: PaceFooAgent;
  let mockEnv: ReturnType<typeof createMockEnv>;
  let mockBucket: MockR2Bucket;

  beforeEach(() => {
    mockInvoke.mockReset();

    mockInvoke.mockResolvedValue({
      content: "Default response",
    });

    mockEnv = createMockEnv();
    const config = createConfig(undefined);
    mockBucket = mockEnv.R2_BUCKET as unknown as MockR2Bucket;

    mockBucket.seed(
      "paceNote/cpl.md",
      `# CPL Competencies

## Leadership
- Demonstrates initiative
- Takes ownership of tasks

## Technical Skills
- Proficient in assigned role`
    );

    mockBucket.seed(
      "paceNote/mcpl.md",
      `# MCPL Competencies

## Leadership
- Supervises junior members
- Provides mentorship

## Technical Skills
- Advanced technical proficiency`
    );

    mockBucket.seed(
      "paceNote/examples.md",
      `# Example Feedback Notes

## Example 1
MCpl Smith demonstrated excellent leadership during Exercise MAPLE RESOLVE.

## Example 2
Cpl Jones showed initiative by completing additional training.`
    );

    agent = new PaceFooAgent(mockEnv, config);
  });

  it("should generate feedback note for CPL rank", async () => {
    const mockResponse = `## Feedback Note for CPL

**Member:** Cpl Test
**Competency:** Leadership - Initiative

Cpl Test demonstrated exceptional initiative during the training exercise by volunteering to lead the logistics team.`;

    setMockLLMResponse(mockResponse);

    const result = await agent.generateNote(
      "cpl",
      "Cpl Test volunteered to lead the logistics team during training"
    );

    expect(result).toContain("Feedback Note");
    expect(result).toContain("CPL");
    expect(result).toContain("initiative");

    expect(mockInvoke).toHaveBeenCalled();
  });

  it("should generate feedback note for MCPL rank", async () => {
    const mockResponse = `## Feedback Note for MCPL

**Member:** MCpl Leader
**Competency:** Leadership - Supervision

MCpl Leader effectively supervised the team during the field exercise.`;

    setMockLLMResponse(mockResponse);

    const result = await agent.generateNote(
      "mcpl",
      "MCpl Leader supervised the team during field exercise"
    );

    expect(result).toContain("Feedback Note");
    expect(result).toContain("MCPL");
    expect(result).toContain("supervised");
  });

  it("should default to CPL for unknown rank", async () => {
    setMockLLMResponse("Generated feedback note");

    const result = await agent.generateNote("unknown_rank", "Some context");

    expect(result).toBeTruthy();
    expect(mockInvoke).toHaveBeenCalled();
  });

  it("should reject empty context", async () => {
    const result = await agent.generateNote("cpl", "");

    expect(result).toContain("couldn't generate");
  });

  it("should reject whitespace-only context", async () => {
    const result = await agent.generateNote("cpl", "   \n\t  ");

    expect(result).toContain("couldn't generate");
  });

  it("should handle missing competencies document", async () => {
    mockBucket.clear();

    const result = await agent.generateNote("cpl", "Test context");

    expect(result).toContain("couldn't generate the feedback note");
  });

  it("should handle missing examples document", async () => {
    await mockBucket.delete("paceNote/examples.md");

    const result = await agent.generateNote("cpl", "Test context");

    expect(result).toContain("couldn't generate the feedback note");
  });

  it("should handle LLM API errors", async () => {
    setMockLLMError("API Error");

    const result = await agent.generateNote("cpl", "Test context");

    expect(result).toContain("issue with the AI service");
  });

  it("should handle network errors", async () => {
    setMockLLMError("Network error");

    const result = await agent.generateNote("cpl", "Test context");

    expect(result).toContain("issue with the AI service");
  });

  it("should convert rank to uppercase in prompt", async () => {
    const getCapturedMessages = captureMockMessages();

    await agent.generateNote("cpl", "Test context");

    const capturedMessages = getCapturedMessages();
    expect(capturedMessages).not.toBeNull();
    expect(capturedMessages).toBeDefined();
    const messages = capturedMessages as unknown[];
    const systemContent = (messages[0] as { content: string }).content;
    expect(systemContent).toContain("CPL");
  });

  it("should include competencies and examples in prompt", async () => {
    const getCapturedMessages = captureMockMessages();

    await agent.generateNote("cpl", "Test context");

    const capturedMessages = getCapturedMessages();
    expect(capturedMessages).not.toBeNull();
    expect(capturedMessages).toBeDefined();
    const messages = capturedMessages as unknown[];
    const systemContent = (messages[0] as { content: string }).content;
    expect(systemContent).toContain("Leadership");
    expect(systemContent).toContain("Technical Skills");
    expect(systemContent).toContain("Example Feedback Notes");
  });

  it("should handle case-insensitive rank matching", async () => {
    setMockLLMResponse("Feedback note");

    const ranks = ["CPL", "Cpl", "cpl", "CpL"];

    for (const rank of ranks) {
      const result = await agent.generateNote(rank, "Test context");
      expect(result).toBeTruthy();
    }
  });
});
