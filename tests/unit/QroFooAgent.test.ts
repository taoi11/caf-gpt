/**
 * tests/unit/QroFooAgent.test.ts
 *
 * Unit tests for QroFooAgent - QR&O policy research using two-call pattern
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
      withStructuredOutput: vi.fn(() => ({
        invoke: mockInvoke,
      })),
    };
  }),
}));

import { QroFooAgent } from "../../src/agents/sub-agents/QroFooAgent";
import { createConfig } from "../../src/config";
import type { ResearchRequest } from "../../src/types";

function setMockSelectorResponse(qroFiles: string[]) {
  mockInvoke.mockResolvedValueOnce({ qro_files: qroFiles });
}

function setMockAnswerResponse(answer: string) {
  mockInvoke.mockResolvedValueOnce({ content: answer });
}

function setMockError(message: string) {
  mockInvoke.mockRejectedValueOnce(new Error(message));
}

interface ChatPromptValue {
  messages?: Array<{ content: string }>;
}

function captureMockAnswerCall(qroFiles: string[]) {
  let capturedInput: unknown = null;

  // First call: selector (return structured output)
  mockInvoke.mockResolvedValueOnce({ qro_files: qroFiles });

  // Second call: answer (capture and return)
  mockInvoke.mockImplementationOnce(async (input: unknown) => {
    capturedInput = input;
    return { content: "Final answer" };
  });

  return () => {
    if (!capturedInput) return null;
    const promptValue = capturedInput as ChatPromptValue;
    return promptValue.messages ?? null;
  };
}

describe("QroFooAgent", () => {
  let agent: QroFooAgent;
  let mockEnv: ReturnType<typeof createMockEnv>;
  let mockBucket: MockR2Bucket;
  let mockAssets: MockFetcher;

  beforeEach(() => {
    mockInvoke.mockReset();

    mockEnv = createMockEnv();
    const config = createConfig(undefined);
    mockBucket = mockEnv.R2_BUCKET as unknown as MockR2Bucket;
    mockAssets = mockEnv.ASSETS as unknown as MockFetcher;

    mockBucket.seed(
      "qro/index.md",
      `# QR&O Index

## Volume 1 - Administration
- vol-1-administration/ch-16-leave.md — Leave Regulations
- vol-1-administration/ch-19-grievances.md — Grievance Procedures

## Volume 2 - Discipline
- vol-2-discipline/ch-107-conduct.md — Service Conduct`
    );

    mockAssets.setPrompt(
      "qro_foo_selector",
      "Select QR&O files from: {qro_index}\nQuery: {user_input}"
    );
    mockAssets.setPrompt("qro_foo_answer", "Answer using: {qro_content}\nQuery: {user_input}");

    mockBucket.seed(
      "qro/vol-1-administration/ch-16-leave.md",
      `# Chapter 16 - Leave Regulations

## Annual Leave
Members are entitled to annual leave as prescribed.

## Special Leave
Special leave may be granted in exceptional circumstances.`
    );

    mockBucket.seed(
      "qro/vol-1-administration/ch-19-grievances.md",
      `# Chapter 19 - Grievance Procedures

## Submitting Grievances
Members may submit grievances through the chain of command.`
    );

    mockBucket.seed(
      "qro/vol-2-discipline/ch-107-conduct.md",
      `# Chapter 107 - Service Conduct

## Standards of Conduct
All members must maintain high standards of conduct.`
    );

    agent = new QroFooAgent(mockEnv, config);
  });

  describe("research", () => {
    it("should complete two-call pattern successfully", async () => {
      setMockSelectorResponse(["vol-1-administration/ch-16-leave.md"]);
      setMockAnswerResponse("QR&O Chapter 16 prescribes annual leave entitlements.");

      const request: ResearchRequest = {
        question: "What does QR&O say about annual leave?",
      };

      const result = await agent.research(request);

      expect(result).toContain("annual leave");
      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });

    it("should load multiple QR&O chapters", async () => {
      setMockSelectorResponse([
        "vol-1-administration/ch-16-leave.md",
        "vol-1-administration/ch-19-grievances.md",
      ]);
      setMockAnswerResponse("Answer based on two chapters");

      const request: ResearchRequest = {
        question: "Tell me about leave and grievances",
      };

      const result = await agent.research(request);

      expect(result).toContain("Answer based on two chapters");
      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });

    it("should format documents with sanitized chapter tags", async () => {
      const getCapturedMessages = captureMockAnswerCall(["vol-1-administration/ch-16-leave.md"]);

      const request: ResearchRequest = {
        question: "Test question",
      };

      await agent.research(request);

      const capturedMessages = getCapturedMessages();
      expect(capturedMessages).not.toBeNull();
      const messages = capturedMessages as unknown[];
      const userMessage = messages.find(
        (m): m is { content: string } =>
          typeof m === "object" && m !== null && "content" in m && typeof m.content === "string"
      );
      expect(userMessage).toBeDefined();
      const content = (userMessage as { content: string }).content;
      expect(content).toContain("<QRO_chapter_ch-16-leave>");
      expect(content).toContain("</QRO_chapter_ch-16-leave>");
    });

    it("should sanitize special characters in filenames", async () => {
      mockBucket.seed("qro/ch-test@file#name.md", "QR&O content with special chars");
      mockInvoke.mockReset();
      const getCapturedMessages = captureMockAnswerCall(["ch-test@file#name.md"]);

      const request: ResearchRequest = {
        question: "Test question",
      };

      await agent.research(request);

      const capturedMessages = getCapturedMessages();
      expect(capturedMessages).not.toBeNull();
      const messages = capturedMessages as unknown[];
      const userMessage = messages.find(
        (m): m is { content: string } =>
          typeof m === "object" && m !== null && "content" in m && typeof m.content === "string"
      );
      expect(userMessage).toBeDefined();
      const content = (userMessage as { content: string }).content;
      expect(content).toContain("<QRO_chapter_ch-test_file_name>");
    });

    it("should reject empty question", async () => {
      const request: ResearchRequest = {
        question: "",
      };

      const result = await agent.research(request);

      expect(result).toContain("error");
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it("should handle selector returning no files", async () => {
      setMockSelectorResponse([]);

      const request: ResearchRequest = {
        question: "Test question",
      };

      const result = await agent.research(request);

      expect(result).toContain("couldn't identify relevant QR&O policy documents");
      expect(mockInvoke).toHaveBeenCalledTimes(1);
    });

    it("should handle missing QR&O index", async () => {
      await mockBucket.delete("qro/index.md");

      const request: ResearchRequest = {
        question: "Test question",
      };

      const result = await agent.research(request);

      expect(result).toContain("couldn't identify relevant");
    });

    it("should handle missing QR&O chapters", async () => {
      setMockSelectorResponse(["vol-99-missing/ch-999-missing.md"]);

      const request: ResearchRequest = {
        question: "Test question",
      };

      const result = await agent.research(request);

      expect(result).toContain("No relevant QR&O policy files found");
    });

    it("should handle partial document loading", async () => {
      await mockBucket.delete("qro/vol-1-administration/ch-19-grievances.md");

      setMockSelectorResponse([
        "vol-1-administration/ch-16-leave.md",
        "vol-1-administration/ch-19-grievances.md",
      ]);
      setMockAnswerResponse("Answer based on available chapters");

      const request: ResearchRequest = {
        question: "Test question",
      };

      const result = await agent.research(request);

      expect(result).toContain("Answer based on available chapters");
      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });

    it("should handle selector errors", async () => {
      setMockError("Selector API error");

      const request: ResearchRequest = {
        question: "Test question",
      };

      const result = await agent.research(request);

      expect(result).toContain("couldn't identify relevant");
    });

    it("should handle answer generation errors", async () => {
      setMockSelectorResponse(["vol-1-administration/ch-16-leave.md"]);
      setMockError("Answer API error");

      const request: ResearchRequest = {
        question: "Test question",
      };

      const result = await agent.research(request);

      expect(result).toContain("issue with the AI service");
    });

    it("should include QR&O index in selector call", async () => {
      let capturedPrompt = "";
      mockInvoke.mockImplementationOnce(async (input: unknown) => {
        if (
          typeof input === "object" &&
          input !== null &&
          "messages" in input &&
          Array.isArray(input.messages) &&
          input.messages[0]
        ) {
          const msg = input.messages[0] as { content: string };
          capturedPrompt = msg.content;
        }
        return { qro_files: ["vol-1-administration/ch-16-leave.md"] };
      });

      mockInvoke.mockResolvedValueOnce({ content: "Answer" });

      const request: ResearchRequest = {
        question: "Test question",
      };

      await agent.research(request);

      expect(capturedPrompt).toContain("QR&O Index");
      expect(capturedPrompt).toContain("ch-16-leave");
    });

    it("should handle special leave questions", async () => {
      setMockSelectorResponse(["vol-1-administration/ch-16-leave.md"]);
      setMockAnswerResponse("Special leave may be granted in exceptional circumstances.");

      const request: ResearchRequest = {
        question: "Can I get special leave?",
      };

      const result = await agent.research(request);

      expect(result).toContain("Special leave");
    });

    it("should handle grievance procedure questions", async () => {
      setMockSelectorResponse(["vol-1-administration/ch-19-grievances.md"]);
      setMockAnswerResponse("Grievances are submitted through the chain of command.");

      const request: ResearchRequest = {
        question: "How do I submit a grievance?",
      };

      const result = await agent.research(request);

      expect(result).toContain("chain of command");
    });

    it("should handle conduct questions", async () => {
      setMockSelectorResponse(["vol-2-discipline/ch-107-conduct.md"]);
      setMockAnswerResponse("All members must maintain high standards of conduct.");

      const request: ResearchRequest = {
        question: "What are the conduct standards?",
      };

      const result = await agent.research(request);

      expect(result).toContain("standards of conduct");
    });
  });
});
