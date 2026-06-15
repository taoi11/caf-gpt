/**
 * tests/unit/QroFooAgent.test.ts
 *
 * Unit tests for QroFooAgent - QR&O policy research using a bounded read_file tool
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

import { QroFooAgent } from "../../src/agents/sub-agents/QroFooAgent";
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

function mockModelReads(files: string[], answer = "Final QR&O answer") {
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

describe("QroFooAgent", () => {
  let agent: QroFooAgent;
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
      "qro_foo_tool_reader",
      `Read QR&O chapters from: {qro_index}
Query: {user_input}`
    );

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
    it("should answer after one valid QR&O read", async () => {
      mockModelReads(
        ["vol-1-administration/ch-16-leave.md"],
        "QR&O Chapter 16 prescribes annual leave entitlements."
      );

      const result = await agent.research({
        question: "What does QR&O say about annual leave?",
      });

      expect(result).toContain("annual leave");
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
      expect(mockGenerateObject).not.toHaveBeenCalled();
    });

    it("should allow up to three successful QR&O reads", async () => {
      mockModelReads(
        [
          "vol-1-administration/ch-16-leave.md",
          "vol-1-administration/ch-19-grievances.md",
          "vol-2-discipline/ch-107-conduct.md",
        ],
        "Answer based on three chapters"
      );

      const result = await agent.research({ question: "Tell me about leave and conduct" });

      expect(result).toContain("three chapters");
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
    });

    it("should include the QR&O index and question in the one model call", async () => {
      mockModelReads(["vol-1-administration/ch-16-leave.md"], "Answer");

      await agent.research({ question: "Can I get special leave?" });

      const call = mockGenerateText.mock.calls[0][0] as ReadFileToolOptions;
      expect(call.system).toContain("QR&O Index");
      expect(call.system).toContain("ch-16-leave");
      expect(call.prompt).toContain("Can I get special leave?");
    });

    it("should return read chapters in sanitized QR&O tags", async () => {
      let content = "";
      mockGenerateText.mockImplementationOnce(async (options: ReadFileToolOptions) => {
        const result = await options.tools?.read_file?.execute({
          file: "vol-1-administration/ch-16-leave.md",
        });
        content = result?.content ?? "";
        return { text: "Answer" };
      });

      await agent.research({ question: "Test question" });

      expect(content).toContain("<QRO_chapter_ch-16-leave>");
      expect(content).toContain("</QRO_chapter_ch-16-leave>");
      expect(content).toContain("Annual Leave");
    });

    it("should let the model correct two invalid QR&O reads", async () => {
      mockModelReads(
        [
          "vol-99-missing/ch-999-missing.md",
          "vol-1-administration/ch-16-leave",
          "vol-1-administration/ch-16-leave.md",
        ],
        "Corrected QR&O answer"
      );

      const result = await agent.research({ question: "Test question" });

      expect(result).toBe("Corrected QR&O answer");
    });

    it("should fail cleanly after the third invalid QR&O read", async () => {
      mockModelReads(
        [
          "vol-99-missing/ch-999-missing.md",
          "vol-88-missing/ch-888-missing.md",
          "vol-77-missing/ch-777-missing.md",
          "vol-1-administration/ch-16-leave.md",
        ],
        "Should not be trusted"
      );

      const result = await agent.research({ question: "Test question" });

      expect(result).toContain("error");
      expect(result).not.toContain("Should not be trusted");
    });

    it("should fail cleanly when the model exceeds five total read attempts", async () => {
      mockModelReads([
        "vol-1-administration/ch-16-leave.md",
        "vol-1-administration/ch-16-leave.md",
        "vol-1-administration/ch-16-leave.md",
        "vol-1-administration/ch-19-grievances.md",
        "vol-1-administration/ch-19-grievances.md",
        "vol-2-discipline/ch-107-conduct.md",
      ]);

      const result = await agent.research({ question: "Test question" });

      expect(result).toContain("error");
    });

    it("should fail cleanly when the model reads more than three chapters", async () => {
      mockModelReads([
        "vol-1-administration/ch-16-leave.md",
        "vol-1-administration/ch-19-grievances.md",
        "vol-2-discipline/ch-107-conduct.md",
        "vol-1-administration/ch-16-leave.md",
        "vol-1-administration/ch-19-grievances.md",
        "vol-2-discipline/ch-107-conduct.md",
      ]);

      const result = await agent.research({ question: "Test question" });

      expect(result).toContain("error");
    });

    it("should reject answers when the model never reads a chapter", async () => {
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

    it("should fail cleanly when the QR&O index is missing", async () => {
      await mockBucket.delete("qro/index.md");

      const result = await agent.research({ question: "Test question" });

      expect(result).toContain("error");
      expect(mockGenerateText).not.toHaveBeenCalled();
    });

    it("should treat missing QR&O chapters as bad calls", async () => {
      mockBucket.seed(
        "qro/index.md",
        `# QR&O Index
- vol-99-missing/ch-999-missing.md — Missing Chapter
- vol-1-administration/ch-16-leave.md — Leave Regulations`
      );
      mockModelReads(
        ["vol-99-missing/ch-999-missing.md", "vol-1-administration/ch-16-leave.md"],
        "Recovered after missing chapter"
      );

      const result = await agent.research({ question: "Test question" });

      expect(result).toContain("Recovered");
    });
  });
});
