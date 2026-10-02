/**
 * tests/unit/QroFooAgent.test.ts
 *
 * Unit tests for QroFooAgent - QR&O policy research via Clef shortlist + prefetch
 *
 * Top-level declarations:
 * - choiceAnswer: Builds a Clef choice answer fixture
 * - shortlistResponse: Builds a Clef shortlist answers payload for pick_1..N
 * - mockClefAi: Returns a ClefAiRunner resolving to a fixed result
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentRetriever } from "../../src/storage/DocumentRetriever";
import { createMockEnv } from "../mocks";
import { MockFetcher, MockR2Bucket } from "../mocks/cloudflare";

import { QroFooAgent } from "../../src/agents/sub-agents/QroFooAgent";
import type { ClefAiRunner } from "../../src/agents/utils/ClefDecision";
import { parseManifestTable } from "../../src/agents/utils/ManifestParser";
import { createConfig } from "../../src/config";
import type { ResearchRequest } from "../../src/types";

const mockGenerateText = vi.fn();

/** Builds a Clef choice answer fixture. */
function choiceAnswer(choice: string, confidence: number) {
  return {
    type: "choice",
    choice,
    confidence,
    probabilities: { [choice]: confidence },
  };
}

/** Builds a Clef shortlist answers payload mapping pick ranks to doc keys or none. */
function shortlistResponse(
  picks: Array<{ choice: string; confidence?: number }>,
  totalRanks = 3
) {
  const answers: { [pickKey: string]: ReturnType<typeof choiceAnswer> } = {};
  picks.forEach((pick, index) => {
    answers[`pick_${index + 1}`] = choiceAnswer(pick.choice, pick.confidence ?? 0.9);
  });
  // Pad remaining ranks with high-confidence none so incomplete fixtures are not malformed.
  for (let rank = picks.length + 1; rank <= totalRanks; rank++) {
    answers[`pick_${rank}`] = choiceAnswer("none", 0.9);
  }
  return { model: "clef-flash", answers, usage: { input_tokens: 10, output_tokens: 3 } };
}

/** Clef-flash shortlist response fixture used by unit tests. */
type ShortlistAiResult = {
  model: string;
  answers: { [pickKey: string]: ReturnType<typeof choiceAnswer> };
  usage?: { input_tokens: number; output_tokens: number };
};

/** Returns a ClefAiRunner whose run() resolves to the given shortlist fixture. */
function mockClefAi(result: ShortlistAiResult): ClefAiRunner {
  return {
    run: vi.fn(async () => result),
  };
}

describe("QroFooAgent", () => {
  let agent: QroFooAgent;
  let mockEnv: ReturnType<typeof createMockEnv>;
  let mockBucket: MockR2Bucket;
  let mockAssets: MockFetcher;
  let clefAi: ClefAiRunner;
  let config: ReturnType<typeof createConfig>;

  beforeEach(() => {
    mockGenerateText.mockReset();
    DocumentRetriever.clearCache();

    mockBucket = new MockR2Bucket();
    mockAssets = new MockFetcher();
    mockEnv = Object.assign(createMockEnv(), {
      R2_BUCKET: mockBucket,
      ASSETS: mockAssets,
    });
    config = createConfig(mockEnv);

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
      `Answer from: {prefetched_documents}
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

    // doc_0=leave, doc_1=grievances, doc_2=conduct
    clefAi = mockClefAi(shortlistResponse([{ choice: "doc_0" }]));
    mockGenerateText.mockResolvedValue({
      text: "QR&O Chapter 16 prescribes annual leave entitlements.",
    });

    agent = new QroFooAgent(mockEnv, config, {
      generateText: mockGenerateText,
      clefAi,
    });
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
    it("should answer after Clef shortlists and prefetches one chapter", async () => {
      const result = await agent.research({
        question: "What does QR&O say about annual leave?",
      });

      expect(result).toContain("annual leave");
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
      expect(clefAi.run).toHaveBeenCalledTimes(1);
      // SAFETY: generateText fake is invoked once with the answer options object.

      const call = mockGenerateText.mock.calls[0][0] as {
        system?: string;
        prompt?: string;
        tools?: unknown;
      };
      expect(call.tools).toBeUndefined();
      expect(call.system).toContain("<QRO_chapter_ch-16-leave>");
      expect(call.prompt).toContain("annual leave");
    });

    it("should prefetch up to three shortlisted chapters", async () => {
      clefAi = mockClefAi(
        shortlistResponse([{ choice: "doc_0" }, { choice: "doc_1" }, { choice: "doc_2" }])
      );
      mockGenerateText.mockResolvedValue({ text: "Answer based on three chapters" });
      agent = new QroFooAgent(mockEnv, config, {
        generateText: mockGenerateText,
        clefAi,
      });

      const result = await agent.research({ question: "Tell me about QR&O policies" });

      expect(result).toContain("three chapters");
      // SAFETY: generateText fake is invoked once with the answer options object.

      const call = mockGenerateText.mock.calls[0][0] as { system?: string };
      expect(call.system).toContain("<QRO_chapter_ch-16-leave>");
      expect(call.system).toContain("<QRO_chapter_ch-19-grievances>");
      expect(call.system).toContain("<QRO_chapter_ch-107-conduct>");
    });

    it("should reject invented shortlist ids that are not in the allowlist", async () => {
      clefAi = mockClefAi(shortlistResponse([{ choice: "invented_path" }]));
      agent = new QroFooAgent(mockEnv, config, {
        generateText: mockGenerateText,
        clefAi,
      });

      await expect(agent.research({ question: "Obscure topic" })).rejects.toThrow(
        "Clef shortlist failed"
      );
      expect(mockGenerateText).not.toHaveBeenCalled();
    });

    it("should allow intentional high-confidence none with an empty prefetch", async () => {
      clefAi = mockClefAi(shortlistResponse([{ choice: "none" }]));
      mockGenerateText.mockResolvedValue({ text: "No relevant chapter was available." });
      agent = new QroFooAgent(mockEnv, config, {
        generateText: mockGenerateText,
        clefAi,
      });

      const result = await agent.research({ question: "Obscure topic" });

      expect(result).toContain("No relevant chapter");
      // SAFETY: generateText fake is invoked once with the answer options object.
      const call = mockGenerateText.mock.calls[0][0] as { system?: string };
      expect(call.system).toContain("No indexed documents were selected");
    });

    it("should propagate Workers AI outages from the Clef shortlist step", async () => {
      clefAi = {
        run: vi.fn(async () => {
          throw new Error("workers ai down");
        }),
      };
      agent = new QroFooAgent(mockEnv, config, {
        generateText: mockGenerateText,
        clefAi,
      });

      await expect(agent.research({ question: "Test question" })).rejects.toThrow(
        "workers ai down"
      );
      expect(mockGenerateText).not.toHaveBeenCalled();
    });

    it("should throw when Clef answers are malformed", async () => {
      clefAi = {
        run: vi.fn(async () => ({
          model: "clef-flash",
          answers: { pick_1: { type: "choice", choice: "doc_0" } },
          usage: { input_tokens: 1, output_tokens: 0 },
        })),
      };
      agent = new QroFooAgent(mockEnv, config, {
        generateText: mockGenerateText,
        clefAi,
      });

      await expect(agent.research({ question: "Test question" })).rejects.toThrow(
        "Clef shortlist failed"
      );
      expect(mockGenerateText).not.toHaveBeenCalled();
    });

    it("should reject empty questions before calling Clef or the model", async () => {
      const request: ResearchRequest = { question: "" };

      await expect(agent.research(request)).rejects.toThrow("Empty research question");
      expect(clefAi.run).not.toHaveBeenCalled();
      expect(mockGenerateText).not.toHaveBeenCalled();
    });

    it("should fail cleanly when the QR&O index is missing", async () => {
      mockBucket.delete("qro/index_v2.md");

      await expect(agent.research({ question: "Test question" })).rejects.toThrow();
      expect(clefAi.run).not.toHaveBeenCalled();
      expect(mockGenerateText).not.toHaveBeenCalled();
    });
  });
});
