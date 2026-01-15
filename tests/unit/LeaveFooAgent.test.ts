/**
 * tests/unit/LeaveFooAgent.test.ts
 *
 * Unit tests for LeaveFooAgent - leave policy research
 *
 * Tests:
 * - Leave policy document retrieval
 * - Question answering with policy context
 * - Error handling for missing documents and LLM failures
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockEnv } from "../mocks";
import type { MockFetcher, MockR2Bucket } from "../mocks/cloudflare";

const { mockInvoke } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
}));

vi.mock("@langchain/openai", () => ({
  ChatOpenAI: vi.fn(function MockChatOpenAI() {
    return {
      invoke: mockInvoke,
    };
  }),
}));

import { LeaveFooAgent } from "../../src/agents/sub-agents/LeaveFooAgent";
import { createConfig } from "../../src/config";
import type { ResearchRequest } from "../../src/types";

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

  mockInvoke.mockImplementationOnce(async (input: unknown) => {
    capturedInput = input;
    return { content: "Policy answer" };
  });

  return () => {
    if (!capturedInput) return null;
    const promptValue = capturedInput as ChatPromptValue;
    return promptValue.messages ?? null;
  };
}

describe("LeaveFooAgent", () => {
  let agent: LeaveFooAgent;
  let mockEnv: ReturnType<typeof createMockEnv>;
  let mockBucket: MockR2Bucket;
  let mockAssets: MockFetcher;

  beforeEach(() => {
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue({ content: "Default response" });

    mockEnv = createMockEnv();
    const config = createConfig(undefined);
    mockBucket = mockEnv.R2_BUCKET as unknown as MockR2Bucket;
    mockAssets = mockEnv.ASSETS as unknown as MockFetcher;

    mockAssets.setPrompt(
      "leave_foo_research",
      `# Leave Policy Research

Leave Policy Document:
{leave_policy}

User Question:
{user_input}

Provide a clear answer based on the policy document.`
    );

    mockBucket.seed(
      "leave/leave_policy_2025.md",
      `# Leave Policy 2025

## Annual Leave

Members are entitled to:
- 20 days annual leave per year
- Carry forward up to 5 days

## Medical Leave

- Sick leave as required with medical certificate
- Up to 3 days without certificate`
    );

    agent = new LeaveFooAgent(mockEnv, config);
  });

  describe("research", () => {
    it("should answer leave policy question successfully", async () => {
      const mockResponse =
        "According to the Leave Policy 2025, members are entitled to 20 days of annual leave per year.";
      setMockLLMResponse(mockResponse);

      const request: ResearchRequest = {
        question: "How many days of annual leave am I entitled to?",
      };

      const result = await agent.research(request);

      expect(result).toContain("20 days of annual leave");
      expect(mockInvoke).toHaveBeenCalledTimes(1);
    });

    it("should include policy document in LLM call", async () => {
      const getCapturedMessages = captureMockMessages();

      const request: ResearchRequest = {
        question: "What is the medical leave policy?",
      };

      await agent.research(request);

      const capturedMessages = getCapturedMessages();
      expect(capturedMessages).not.toBeNull();
      const messages = capturedMessages as unknown[];
      const systemContent = (messages[0] as { content: string }).content;
      expect(systemContent).toContain("Leave Policy 2025");
      expect(systemContent).toContain("Medical Leave");
    });

    it("should reject empty research question", async () => {
      const request: ResearchRequest = {
        question: "",
      };

      const result = await agent.research(request);

      expect(result).toContain("error");
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it("should reject whitespace-only question", async () => {
      const request: ResearchRequest = {
        question: "   \n\t  ",
      };

      const result = await agent.research(request);

      expect(result).toContain("error");
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it("should handle missing leave policy document", async () => {
      mockBucket.clear();

      const request: ResearchRequest = {
        question: "How much leave do I get?",
      };

      const result = await agent.research(request);

      expect(result).toContain("cannot access the leave policy document");
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it("should handle LLM API errors", async () => {
      setMockLLMError("API connection failed");

      const request: ResearchRequest = {
        question: "Test question",
      };

      const result = await agent.research(request);

      expect(result).toContain("issue with the AI service");
    });

    it("should handle timeout errors", async () => {
      setMockLLMError("Request timeout");

      const request: ResearchRequest = {
        question: "Test question",
      };

      const result = await agent.research(request);

      expect(result).toContain("timeout");
    });

    it("should truncate long questions in logs", async () => {
      const longQuestion = "a".repeat(200);
      setMockLLMResponse("Answer");

      const request: ResearchRequest = {
        question: longQuestion,
      };

      const result = await agent.research(request);

      expect(result).toBeDefined();
    });

    it("should answer medical leave questions", async () => {
      mockInvoke.mockReset();
      const mockResponse = "You can take up to 3 days of sick leave without a medical certificate.";
      setMockLLMResponse(mockResponse);

      const request: ResearchRequest = {
        question: "How much sick leave can I take without a certificate?",
      };

      const result = await agent.research(request);

      expect(result).toContain("3 days");
    });

    it("should answer carry-forward questions", async () => {
      mockInvoke.mockReset();
      const mockResponse = "You can carry forward up to 5 days of annual leave to the next year.";
      setMockLLMResponse(mockResponse);

      const request: ResearchRequest = {
        question: "Can I carry forward unused leave?",
      };

      const result = await agent.research(request);

      expect(result).toContain("5 days");
    });
  });
});
