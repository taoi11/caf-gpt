/**
 * tests/unit/DoadFooAgent.test.ts
 *
 * Unit tests for DoadFooAgent - DOAD policy research using a bounded read_file tool
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentRetriever } from "../../src/storage/DocumentRetriever";
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

interface ReadFileToolOptions {
  system?: string;
  prompt?: string;
  tools?: {
    read_file?: {
      execute: (input: { file: string }) => Promise<{ ok: boolean; content: string }>;
    };
  };
}

function mockModelReads(files: string[], answer = "Final DOAD answer") {
  mockGenerateText.mockImplementationOnce(async (options: ReadFileToolOptions) => {
    for (const file of files) {
      await options.tools?.read_file?.execute({ file });
    }
    return { text: answer };
  });
}

function mockModelWithoutReads(answer = "Unsupported answer") {
  mockGenerateText.mockResolvedValueOnce({ text: answer });
}

describe("DoadFooAgent", () => {
  let agent: DoadFooAgent;
  let mockEnv: ReturnType<typeof createMockEnv>;
  let mockBucket: MockR2Bucket;
  let mockAssets: MockFetcher;

  beforeEach(() => {
    mockGenerateText.mockReset();
    mockGenerateObject.mockReset();
    DocumentRetriever.clearCache();

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
      "doad_foo_tool_reader",
      `Read DOADs from: {doad_table}
Query: {user_input}`
    );

    mockBucket.seed(
      "doad/5019-0.md",
      `# DOAD 5019-0 - Conduct and Performance Deficiency

## Purpose
This order establishes policy for addressing conduct and performance deficiencies.`
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
    it("should answer after one valid DOAD read", async () => {
      mockModelReads(
        ["5019-0"],
        "According to DOAD 5019-0, conduct deficiencies are addressed by policy."
      );

      const result = await agent.research({
        question: "What is the policy on conduct deficiencies?",
      });

      expect(result).toContain("DOAD 5019-0");
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
      expect(mockGenerateObject).not.toHaveBeenCalled();
    });

    it("should allow up to three successful DOAD reads", async () => {
      mockModelReads(["5019-0", "5031-1", "7023-1"], "Answer based on three DOADs");

      const result = await agent.research({ question: "Tell me about CAF policies" });

      expect(result).toContain("three DOADs");
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
    });

    it("should include the DOAD table and question in the one model call", async () => {
      mockModelReads(["5019-0"], "Answer");

      await agent.research({ question: "What is the test policy?" });

      const call = mockGenerateText.mock.calls[0][0] as ReadFileToolOptions;
      expect(call.system).toContain("DOAD Index");
      expect(call.system).toContain("5019-0");
      expect(call.prompt).toContain("What is the test policy?");
    });

    it("should return the read document in DOAD tags", async () => {
      let content = "";
      mockGenerateText.mockImplementationOnce(async (options: ReadFileToolOptions) => {
        const result = await options.tools?.read_file?.execute({ file: "5019-0" });
        content = result?.content ?? "";
        return { text: "Answer" };
      });

      await agent.research({ question: "Test question" });

      expect(content).toContain("<DOAD_5019-0>");
      expect(content).toContain("</DOAD_5019-0>");
      expect(content).toContain("Conduct and Performance");
    });

    it("should let the model correct two invalid DOAD reads", async () => {
      mockModelReads(["9999-9", "8888-8", "5019-0"], "Corrected answer");

      const result = await agent.research({ question: "Test question" });

      expect(result).toBe("Corrected answer");
    });

    it("should fail cleanly after the third invalid DOAD read", async () => {
      mockModelReads(["9999-9", "8888-8", "7777-7", "5019-0"], "Should not be trusted");

      const result = await agent.research({ question: "Test question" });

      expect(result).toContain("error");
      expect(result).not.toContain("Should not be trusted");
    });

    it("should fail cleanly when AI SDK returns a tool-error step", async () => {
      mockGenerateText.mockImplementationOnce(async (options: ReadFileToolOptions) => {
        await options.tools?.read_file?.execute({ file: "5019-0" });
        return {
          text: "Should not be trusted",
          steps: [{ content: [{ type: "tool-error" }] }],
        };
      });

      const result = await agent.research({ question: "Test question" });

      expect(result).toContain("error");
      expect(result).not.toContain("Should not be trusted");
    });

    it("should fail cleanly when the model exceeds five total read attempts", async () => {
      mockModelReads(["5019-0", "5019-0", "5019-0", "9999-9", "8888-8", "5019-0"]);

      const result = await agent.research({ question: "Test question" });

      expect(result).toContain("error");
    });

    it("should fail cleanly when the model reads more than three documents", async () => {
      mockModelReads(["5019-0", "5031-1", "7023-1", "5019-0", "5031-1", "7023-1"]);

      const result = await agent.research({ question: "Test question" });

      expect(result).toContain("error");
    });

    it("should reject answers when the model never reads a document", async () => {
      mockModelWithoutReads();

      const result = await agent.research({ question: "Test question" });

      expect(result).toContain("error");
    });

    it("should reject empty questions before calling the model", async () => {
      const request: ResearchRequest = { question: "" };

      const result = await agent.research(request);

      expect(result).toContain("error");
      expect(mockGenerateText).not.toHaveBeenCalled();
    });

    it("should fail cleanly when the DOAD index is missing", async () => {
      mockAssets.setPrompt("DOAD_Table", "");

      const result = await agent.research({ question: "Test question" });

      expect(result).toContain("error");
      expect(mockGenerateText).not.toHaveBeenCalled();
    });

    it("should treat missing DOAD documents as bad calls", async () => {
      mockAssets.setPrompt(
        "DOAD_Table",
        `# DOAD Index
| Number | Title |
|--------|-------|
| 9999-9 | Missing Document |
| 5019-0 | Conduct and Performance Deficiency |`
      );
      mockModelReads(["9999-9", "5019-0"], "Recovered after missing document");

      const result = await agent.research({ question: "Test question" });

      expect(result).toContain("Recovered");
    });
  });
});
