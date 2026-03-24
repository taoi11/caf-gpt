/**
 * tests/unit/DoadFooAgent.test.ts
 *
 * Unit tests for DoadFooAgent - DOAD policy research using two-call pattern
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockEnv } from "../mocks";
import type { MockFetcher, MockR2Bucket } from "../mocks/cloudflare";

const { mockGenerateText, mockGenerateObject } = vi.hoisted(() => ({
  mockGenerateText: vi.fn(),
  mockGenerateObject: vi.fn(),
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    generateText: mockGenerateText,
    generateObject: mockGenerateObject,
  };
});

vi.mock("ai-gateway-provider", () => ({
  createAiGateway: vi.fn(() => vi.fn((model: unknown) => model)),
}));
vi.mock("ai-gateway-provider/providers/unified", () => ({
  createUnified: vi.fn(() => vi.fn((model: string) => model)),
}));

import { DoadFooAgent } from "../../src/agents/sub-agents/DoadFooAgent";
import { createConfig } from "../../src/config";
import type { ResearchRequest } from "../../src/types";

function setMockSelectorResponse(doadNumbers: string[]) {
  mockGenerateObject.mockResolvedValueOnce({ object: { doad_numbers: doadNumbers } });
}

function setMockAnswerResponse(answer: string) {
  mockGenerateText.mockResolvedValueOnce({ text: answer });
}

function setMockError(message: string) {
  mockGenerateObject.mockRejectedValueOnce(new Error(message));
}

function setMockAnswerError(message: string) {
  mockGenerateText.mockRejectedValueOnce(new Error(message));
}

function captureMockAnswerCall() {
  // First call: selector (return structured output)
  mockGenerateObject.mockResolvedValueOnce({ object: { doad_numbers: ["5019-0"] } });

  // Second call: answer (capture and return)
  mockGenerateText.mockResolvedValueOnce({ text: "Final answer" });

  return () => {
    const calls = mockGenerateText.mock.calls;
    if (calls.length === 0) return null;
    const lastCall = calls[calls.length - 1][0];
    if (lastCall?.system) {
      return [{ content: lastCall.system }];
    }
    return null;
  };
}

describe("DoadFooAgent", () => {
  let agent: DoadFooAgent;
  let mockEnv: ReturnType<typeof createMockEnv>;
  let mockBucket: MockR2Bucket;
  let mockAssets: MockFetcher;

  beforeEach(() => {
    mockGenerateText.mockReset();
    mockGenerateObject.mockReset();

    mockEnv = createMockEnv();
    const config = createConfig(undefined);
    mockBucket = mockEnv.R2_BUCKET as unknown as MockR2Bucket;
    mockAssets = mockEnv.ASSETS as unknown as MockFetcher;

    mockAssets.setPrompt(
      "DOAD_Table",
      `# DOAD Index
| Number | Title |
|--------|-------|
| 5019-0 | Conduct and Performance Deficiency |
| 5031-1 | Canadian Forces Grievance Board |
| 7023-1 | Relocation Benefits |`
    );

    mockAssets.setPrompt(
      "doad_foo_selector",
      "Select DOADs from: {doad_table}\nQuery: {user_input}"
    );
    mockAssets.setPrompt("doad_foo_answer", "Answer using: {doad_content}\nQuery: {user_input}");

    mockBucket.seed(
      "doad/5019-0.md",
      `# DOAD 5019-0 - Conduct and Performance Deficiency

## Purpose
This order establishes policy for addressing conduct and performance deficiencies.

## Application
Applies to all CAF members.`
    );

    mockBucket.seed(
      "doad/5031-1.md",
      `# DOAD 5031-1 - Canadian Forces Grievance Board

## Purpose
Establishes grievance procedures.`
    );

    mockBucket.seed(
      "doad/7023-1.md",
      `# DOAD 7023-1 - Relocation Benefits

## Entitlements
Members are entitled to relocation assistance when posted.`
    );

    agent = new DoadFooAgent(mockEnv, config);
  });

  describe("research", () => {
    it("should complete two-call pattern successfully", async () => {
      setMockSelectorResponse(["5019-0"]);
      setMockAnswerResponse("DOAD 5019-0 establishes policy for addressing conduct deficiencies.");

      const request: ResearchRequest = {
        question: "What is the policy on conduct deficiencies?",
      };

      const result = await agent.research(request);

      expect(result).toContain("conduct deficiencies");
      expect(mockGenerateObject).toHaveBeenCalledTimes(1);
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
    });

    it("should load multiple DOADs in parallel", async () => {
      setMockSelectorResponse(["5019-0", "5031-1", "7023-1"]);
      setMockAnswerResponse("Answer based on three DOADs");

      const request: ResearchRequest = {
        question: "Tell me about CAF policies",
      };

      const result = await agent.research(request);

      expect(result).toContain("Answer based on three DOADs");
      expect(mockGenerateObject).toHaveBeenCalledTimes(1);
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
    });

    it("should format documents with DOAD tags", async () => {
      mockBucket.seed("DOAD/5019-0.md", "DOAD 5019-0 content");
      mockGenerateText.mockReset();
      mockGenerateObject.mockReset();
      const getCapturedMessages = captureMockAnswerCall();

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
      expect(content).toContain("<DOAD_5019-0>");
      expect(content).toContain("</DOAD_5019-0>");
    });

    it("should reject empty question", async () => {
      const request: ResearchRequest = {
        question: "",
      };

      const result = await agent.research(request);

      expect(result).toContain("error");
      expect(mockGenerateObject).not.toHaveBeenCalled();
      expect(mockGenerateText).not.toHaveBeenCalled();
    });

    it("should handle selector returning no DOADs", async () => {
      setMockSelectorResponse([]);

      const request: ResearchRequest = {
        question: "Test question",
      };

      const result = await agent.research(request);

      expect(result).toContain("couldn't identify relevant DOAD policy documents");
      expect(mockGenerateObject).toHaveBeenCalledTimes(1);
    });

    it("should handle missing DOAD index", async () => {
      const emptyAssets = mockEnv.ASSETS as unknown as MockFetcher;
      emptyAssets.setPrompt("DOAD_Table", "");

      const request: ResearchRequest = {
        question: "Test question",
      };

      const result = await agent.research(request);

      expect(result).toContain("couldn't identify relevant");
    });

    it("should handle missing DOAD documents", async () => {
      setMockSelectorResponse(["9999-9"]);

      const request: ResearchRequest = {
        question: "Test question",
      };

      const result = await agent.research(request);

      expect(result).toContain("No relevant DOAD policy files found");
    });

    it("should handle partial document loading", async () => {
      await mockBucket.delete("doad/5031-1.md");

      setMockSelectorResponse(["5019-0", "5031-1"]);
      setMockAnswerResponse("Answer based on available DOADs");

      const request: ResearchRequest = {
        question: "Test question",
      };

      const result = await agent.research(request);

      expect(result).toContain("Answer based on available DOADs");
      expect(mockGenerateObject).toHaveBeenCalledTimes(1);
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
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
      setMockSelectorResponse(["5019-0"]);
      setMockAnswerError("Answer API error");

      const request: ResearchRequest = {
        question: "Test question",
      };

      const result = await agent.research(request);

      expect(result).toContain("issue with the AI service");
    });

    it("should include DOAD table in selector call", async () => {
      mockGenerateObject.mockResolvedValueOnce({ object: { doad_numbers: ["5019-0"] } });
      mockGenerateText.mockResolvedValueOnce({ text: "Answer" });

      const request: ResearchRequest = {
        question: "Test question",
      };

      await agent.research(request);

      const selectorCall = mockGenerateObject.mock.calls[0][0];
      const capturedSystem = selectorCall.system || "";
      expect(capturedSystem).toContain("DOAD Index");
      expect(capturedSystem).toContain("5019-0");
    });

    it("should handle grievance questions", async () => {
      setMockSelectorResponse(["5031-1"]);
      setMockAnswerResponse("The Canadian Forces Grievance Board handles grievances.");

      const request: ResearchRequest = {
        question: "How do I file a grievance?",
      };

      const result = await agent.research(request);

      expect(result).toContain("Grievance");
    });

    it("should handle relocation questions", async () => {
      setMockSelectorResponse(["7023-1"]);
      setMockAnswerResponse("Members receive relocation assistance when posted.");

      const request: ResearchRequest = {
        question: "What relocation benefits am I entitled to?",
      };

      const result = await agent.research(request);

      expect(result).toContain("relocation");
    });
  });
});
