/**
 * tests/unit/DoadFooAgent.test.ts
 *
 * Unit tests for DoadFooAgent - DOAD policy research via Clef shortlist + prefetch
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

import { DoadFooAgent } from "../../src/agents/sub-agents/DoadFooAgent";
import type { ClefAiRunner } from "../../src/agents/utils/ClefDecision";
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
function shortlistResponse(picks: Array<{ choice: string; confidence?: number }>) {
  const answers: { [pickKey: string]: ReturnType<typeof choiceAnswer> } = {};
  picks.forEach((pick, index) => {
    answers[`pick_${index + 1}`] = choiceAnswer(pick.choice, pick.confidence ?? 0.9);
  });
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

describe("DoadFooAgent", () => {
  let agent: DoadFooAgent;
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
      "doad/index_v2.md",
      `# DOAD Index
| Id | Title | File |
|---|---|---|
| 5019-0 | Conduct and Performance Deficiency | 5019-0.md |
| 5031-1 | Canadian Forces Grievance Board | 5031-1.md |
| 7023-1 | Relocation Benefits | 7023-1.md |
| 6000-1 | Indexed but unavailable test document | 6000-1.md |`
    );

    mockAssets.setPrompt(
      "doad_foo_tool_reader",
      `Answer from: {prefetched_documents}
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

    // doc_0=5019-0, doc_1=5031-1, doc_2=7023-1, doc_3=6000-1
    clefAi = mockClefAi(shortlistResponse([{ choice: "doc_0" }]));
    mockGenerateText.mockResolvedValue({
      text: "According to DOAD 5019-0, conduct deficiencies are addressed by policy.",
    });

    agent = new DoadFooAgent(mockEnv, config, {
      generateText: mockGenerateText,
      clefAi,
    });
  });

  describe("research", () => {
    it("should answer after Clef shortlists and prefetches one DOAD", async () => {
      const result = await agent.research({
        question: "What is the policy on conduct deficiencies?",
      });

      expect(result).toContain("DOAD 5019-0");
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
      expect(clefAi.run).toHaveBeenCalledTimes(1);
      // SAFETY: generateText fake is invoked once with the answer options object.

      const call = mockGenerateText.mock.calls[0][0] as {
        system?: string;
        prompt?: string;
        tools?: unknown;
      };
      expect(call.tools).toBeUndefined();
      expect(call.system).toContain("<DOAD_5019-0>");
      expect(call.system).toContain("Conduct and Performance");
      expect(call.prompt).toContain("conduct deficiencies");
    });

    it("should prefetch up to three shortlisted DOADs", async () => {
      clefAi = mockClefAi(
        shortlistResponse([{ choice: "doc_0" }, { choice: "doc_1" }, { choice: "doc_2" }])
      );
      mockGenerateText.mockResolvedValue({ text: "Answer based on three DOADs" });
      agent = new DoadFooAgent(mockEnv, config, {
        generateText: mockGenerateText,
        clefAi,
      });

      const result = await agent.research({ question: "Tell me about CAF policies" });

      expect(result).toContain("three DOADs");
      // SAFETY: generateText fake is invoked once with the answer options object.

      const call = mockGenerateText.mock.calls[0][0] as { system?: string };
      expect(call.system).toContain("<DOAD_5019-0>");
      expect(call.system).toContain("<DOAD_5031-1>");
      expect(call.system).toContain("<DOAD_7023-1>");
    });

    it("should reject invented shortlist ids that are not in the allowlist", async () => {
      clefAi = mockClefAi(shortlistResponse([{ choice: "doc_999" }, { choice: "none" }]));
      mockGenerateText.mockResolvedValue({ text: "No relevant DOAD was available." });
      agent = new DoadFooAgent(mockEnv, config, {
        generateText: mockGenerateText,
        clefAi,
      });

      const result = await agent.research({ question: "Obscure topic" });

      expect(result).toContain("No relevant DOAD");
      // SAFETY: generateText fake is invoked once with the answer options object.

      const call = mockGenerateText.mock.calls[0][0] as { system?: string };
      expect(call.system).toContain("No indexed documents were selected");
      expect(call.system).not.toContain("<DOAD_");
    });

    it("should propagate Workers AI outages from the Clef shortlist step", async () => {
      clefAi = {
        run: vi.fn(async () => {
          throw new Error("workers ai down");
        }),
      };
      agent = new DoadFooAgent(mockEnv, config, {
        generateText: mockGenerateText,
        clefAi,
      });

      await expect(agent.research({ question: "Test question" })).rejects.toThrow(
        "workers ai down"
      );
      expect(mockGenerateText).not.toHaveBeenCalled();
    });

    it("should fail closed to empty prefetch when Clef answers are malformed", async () => {
      clefAi = {
        run: vi.fn(async () => ({
          model: "clef-flash",
          answers: {},
          usage: { input_tokens: 1, output_tokens: 0 },
        })),
      };
      mockGenerateText.mockResolvedValue({ text: "Insufficient DOAD context." });
      agent = new DoadFooAgent(mockEnv, config, {
        generateText: mockGenerateText,
        clefAi,
      });

      const result = await agent.research({ question: "Test question" });

      expect(result).toContain("Insufficient");
      // SAFETY: generateText fake is invoked once with the answer options object.

      const call = mockGenerateText.mock.calls[0][0] as { system?: string };
      expect(call.system).toContain("No indexed documents were selected");
    });

    it("should reject empty questions before calling Clef or the model", async () => {
      const request: ResearchRequest = { question: "" };

      await expect(agent.research(request)).rejects.toThrow("Empty research question");
      expect(clefAi.run).not.toHaveBeenCalled();
      expect(mockGenerateText).not.toHaveBeenCalled();
    });

    it("should fail cleanly when the DOAD index is missing", async () => {
      mockBucket.delete("doad/index_v2.md");

      await expect(agent.research({ question: "Test question" })).rejects.toThrow();
      expect(clefAi.run).not.toHaveBeenCalled();
      expect(mockGenerateText).not.toHaveBeenCalled();
    });

    it("should reject when a shortlisted DOAD document cannot be retrieved", async () => {
      // doc_3 = 6000-1 is indexed but not seeded in R2
      clefAi = mockClefAi(shortlistResponse([{ choice: "doc_3" }]));
      agent = new DoadFooAgent(mockEnv, config, {
        generateText: mockGenerateText,
        clefAi,
      });

      await expect(agent.research({ question: "Test question" })).rejects.toThrow(
        "Document not found"
      );
      expect(mockGenerateText).not.toHaveBeenCalled();
    });
  });
});
