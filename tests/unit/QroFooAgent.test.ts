/**
 * tests/unit/QroFooAgent.test.ts
 *
 * Unit tests for QroFooAgent - QR&O policy research using a bounded read_file tool
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentRetriever } from "../../src/storage/DocumentRetriever";
import { createMockEnv } from "../mocks";
import { MockFetcher, MockR2Bucket } from "../mocks/cloudflare";

import { QroFooAgent } from "../../src/agents/sub-agents/QroFooAgent";
import { parseManifestTable } from "../../src/agents/utils/ManifestParser";
import { createConfig } from "../../src/config";
import type { ResearchRequest } from "../../src/types";

const mockGenerateText = vi.fn();

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
    DocumentRetriever.clearCache();

    mockBucket = new MockR2Bucket();
    mockAssets = new MockFetcher();
    mockEnv = Object.assign(createMockEnv(), {
      R2_BUCKET: mockBucket,
      ASSETS: mockAssets,
    });

    const config = createConfig(mockEnv);

    mockBucket.seed(
      "qro/index_v2.md",
      `# QR&O Index
| Id | Title | File |
|---|---|---|
| vol-1-administration/ch-16-leave.md | Leave Regulations | vol-1-administration/ch-16-leave.md |
| vol-1-administration/ch-19-grievances.md | Grievance Procedures | vol-1-administration/ch-19-grievances.md |
| vol-2-discipline/ch-107-conduct.md | Service Conduct | vol-2-discipline/ch-107-conduct.md |`
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

    agent = new QroFooAgent(mockEnv, config, { generateText: mockGenerateText });
  });

  describe("manifest parsing", () => {
    it("should allow files from the current 3-column table index", () => {
      const manifest = parseManifestTable(`| Id | Title | File |
|---|---|---|
| vol-1-administration/ch-16-leave.md | Leave Regulations | vol-1-administration/ch-16-leave.md |
| vol-1-administration/ch-19-grievances.md | Grievance Procedures | vol-1-administration/ch-19-grievances.md |
| vol-2-discipline/ch-107-conduct.md | Service Conduct | vol-2-discipline/ch-107-conduct.md |`);
      expect(manifest.size).toBe(3);
      expect(manifest.get("vol-1-administration/ch-16-leave.md")).toBe(
        "vol-1-administration/ch-16-leave.md"
      );
      expect(manifest.get("vol-1-administration/ch-19-grievances.md")).toBe(
        "vol-1-administration/ch-19-grievances.md"
      );
      expect(manifest.get("vol-2-discipline/ch-107-conduct.md")).toBe(
        "vol-2-discipline/ch-107-conduct.md"
      );
    });

    it("should reject prose mentions, non-table lines, and unsafe index rows", () => {
      const manifest = parseManifestTable(`# QR&O Index
For background, read vol-9-misleading/ch-99-not-an-entry.md before continuing.
- This description mentions vol-8-misleading/ch-88-not-an-entry.md in prose.
| Id | Title | File |
|---|---|---|
| vol-1-administration/ch-16-leave.md | Safe entry | vol-1-administration/ch-16-leave.md |
| /absolute/ch-1.md | Absolute path | /absolute/ch-1.md |
| vol-1//ch-2.md | Empty segment | vol-1//ch-2.md |
| ./vol-1/ch-3.md | Leading dot segment | ./vol-1/ch-3.md |
| vol-1/./ch-4.md | Dot segment | vol-1/./ch-4.md |
| vol-1/../ch-5.md | Traversal | vol-1/../ch-5.md |
| ../ch-6.md | Leading traversal | ../ch-6.md |
| vol-1\\\\ch-7.md | Backslash path | vol-1\\\\ch-7.md |
| Bad-Only | Two column row |
`);
      expect([...manifest.keys()]).toEqual(["vol-1-administration/ch-16-leave.md"]);
    });
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

      // SAFETY: This test's fake is invoked once by ToolReadingAgent with ReadFileToolOptions.
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

      await expect(agent.research({ question: "Test question" })).rejects.toThrow(
        "correction budget exhausted"
      );
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

      await expect(agent.research({ question: "Test question" })).rejects.toThrow(
        "total call limit exceeded"
      );
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

      await expect(agent.research({ question: "Test question" })).rejects.toThrow(
        "total call limit exceeded"
      );
    });

    it("should reject answers when the model never reads a chapter", async () => {
      mockModelWithoutReads();

      await expect(agent.research({ question: "Test question" })).rejects.toThrow(
        "did not successfully read"
      );
    });

    it("should reject empty questions before calling the model", async () => {
      const request: ResearchRequest = { question: "" };

      await expect(agent.research(request)).rejects.toThrow("Empty research question");
      expect(mockGenerateText).not.toHaveBeenCalled();
    });

    it("should fail cleanly when the QR&O index is missing", async () => {
      await mockBucket.delete("qro/index_v2.md");

      await expect(agent.research({ question: "Test question" })).rejects.toThrow(
        "Document not found"
      );
      expect(mockGenerateText).not.toHaveBeenCalled();
    });

    it("should reject when an indexed QR&O chapter cannot be retrieved", async () => {
      mockBucket.seed(
        "qro/index_v2.md",
        `# QR&O Index
| vol-99-missing/ch-999-missing.md | Missing Chapter | vol-99-missing/ch-999-missing.md |
| vol-1-administration/ch-16-leave.md | Leave Regulations | vol-1-administration/ch-16-leave.md |`
      );
      mockModelReads(
        ["vol-99-missing/ch-999-missing.md", "vol-1-administration/ch-16-leave.md"],
        "Recovered after missing chapter"
      );

      await expect(agent.research({ question: "Test question" })).rejects.toThrow(
        "Document not found"
      );
    });
  });
});
