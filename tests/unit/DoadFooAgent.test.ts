/**
 * tests/unit/DoadFooAgent.test.ts
 *
 * Unit tests for DoadFooAgent - DOAD policy research via Clef shortlist + prefetch
 *
 * Top-level declarations:
 * - choiceAnswer: Builds a Clef choice answer fixture
 * - shortlistResponse: Builds a Clef shortlist answers payload for group_pick and pick_1..N
 * - mockClefAi: Returns a ClefAiRunner resolving to a fixed result
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentRetriever } from "../../src/storage/DocumentRetriever";
import { createMockEnv } from "../mocks";
import { MockFetcher, MockR2Bucket } from "../mocks/cloudflare";

import { DoadFooAgent, doadSeriesGroup } from "../../src/agents/sub-agents/DoadFooAgent";
import type { ClefAiRunner } from "../../src/agents/utils/ClefDecision";
import { createConfig } from "../../src/config";
import { AgentValidationError } from "../../src/errors";
import { Logger } from "../../src/Logger";
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

/** Builds a Clef shortlist payload: the stage-1 group pick plus stage-2 pick ranks (doc keys or none). */
function shortlistResponse(
  picks: Array<{ choice: string; confidence?: number }>,
  { group = "group_0", totalRanks = 3 }: { group?: string; totalRanks?: number } = {}
) {
  const answers: { [pickKey: string]: ReturnType<typeof choiceAnswer> } = {};
  answers.group_pick = choiceAnswer(group, 0.9);
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

    // Series groups: group_0=5000 (doc_0=5019-0, doc_1=5031-1), group_1=7000 (doc_0=7023-1),
    // group_2=6000 (doc_0=6000-1)
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
      // group_pick chooses the group, then one request per rank: pick_1 chooses the document,
      // pick_2 answers none and ends the shortlist.
      expect(clefAi.run).toHaveBeenCalledTimes(3);
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

    it("should prefetch every confident pick within the chosen series only", async () => {
      clefAi = mockClefAi(shortlistResponse([{ choice: "doc_0" }, { choice: "doc_1" }]));
      mockGenerateText.mockResolvedValue({ text: "Answer based on two DOADs" });
      agent = new DoadFooAgent(mockEnv, config, {
        generateText: mockGenerateText,
        clefAi,
      });

      const result = await agent.research({ question: "Tell me about CAF policies" });

      expect(result).toContain("two DOADs");
      // SAFETY: generateText fake is invoked once with the answer options object.

      const call = mockGenerateText.mock.calls[0][0] as { system?: string };
      expect(call.system).toContain("<DOAD_5019-0>");
      expect(call.system).toContain("<DOAD_5031-1>");
      expect(call.system).not.toContain("<DOAD_7023-1>");
    });

    it("groups DOAD rows by series for the stage-1 question", async () => {
      await agent.research({ question: "conduct?" });
      // SAFETY: the ClefAiRunner mock is invoked with the stage-1 Clef System One request first.
      const request = vi.mocked(clefAi.run).mock.calls[0][1] as {
        questions: { group_pick: { criteria: Record<string, string> } };
      };
      expect(request.questions.group_pick.criteria).toEqual({
        none: expect.any(String),
        group_0:
          "DAOD 5000 series: Conduct and Performance Deficiency; Canadian Forces Grievance Board",
        group_1: "DAOD 7000 series: Relocation Benefits",
        group_2: "DAOD 6000 series: Indexed but unavailable test document",
      });
    });

    it("maps DAOD ids to their thousand series", () => {
      expect(doadSeriesGroup({ id: "5019-0", title: "", file: "5019-0.md" })).toEqual({
        key: "5000",
        label: "DAOD 5000 series",
      });
      expect(doadSeriesGroup({ id: "1000-10", title: "", file: "1000-10.md" }).key).toBe("1000");
      expect(doadSeriesGroup({ id: "misc", title: "", file: "misc.md" }).key).toBe("");
    });

    it("should reject invented shortlist ids that are not in the allowlist", async () => {
      clefAi = mockClefAi(shortlistResponse([{ choice: "doc_999" }]));
      agent = new DoadFooAgent(mockEnv, config, {
        generateText: mockGenerateText,
        clefAi,
      });

      await expect(agent.research({ question: "Obscure topic" })).rejects.toThrow(
        "Clef shortlist failed"
      );
      expect(mockGenerateText).not.toHaveBeenCalled();
    });

    it("logs only the reason code and content-free diagnostics when the shortlist fails", async () => {
      clefAi = mockClefAi(shortlistResponse([{ choice: "doc_999" }]));
      agent = new DoadFooAgent(mockEnv, config, {
        generateText: mockGenerateText,
        clefAi,
      });
      const loggerError = vi.spyOn(Logger.getInstance(), "error");

      await expect(agent.research({ question: "Sensitive member question" })).rejects.toThrow(
        AgentValidationError
      );

      const failure = loggerError.mock.calls.find(
        ([message]) => message === "doad_foo shortlist-prefetch research failed"
      );
      expect(failure?.[1]).toEqual({
        processingTime: expect.any(Number),
        questionLength: "Sensitive member question".length,
        errorName: "AgentValidationError",
        errorCode: "AGENT_VALIDATION_ERROR",
        recoverable: false,
        shortlistReason: "clef_invalid_choice",
        shortlistStage: "document",
        shortlistGroup: {
          optionCount: 4,
          rankReached: 1,
          topIsNone: false,
          topConfidence: 0.9,
          topMargin: 0.9,
        },
        shortlistDocument: {
          optionCount: 3,
          rankReached: 1,
          topIsNone: false,
          topConfidence: 0.9,
          topMargin: 0.9,
        },
      });
      const logged = JSON.stringify(failure?.[1]);
      for (const content of ["Sensitive", "doc_999", "group_0", "5019", "Conduct", "DAOD"]) {
        expect(logged).not.toContain(content);
      }
      loggerError.mockRestore();
    });

    it("logs the Workers AI error name and numeric code, never the message", async () => {
      const upstream = new Error("5006: input contains sensitive member question");
      upstream.name = "InferenceUpstreamError";
      clefAi = { run: vi.fn(async () => Promise.reject(upstream)) };
      agent = new DoadFooAgent(mockEnv, config, {
        generateText: mockGenerateText,
        clefAi,
      });
      const loggerError = vi.spyOn(Logger.getInstance(), "error");

      await expect(agent.research({ question: "Test question" })).rejects.toBe(upstream);

      const failure = loggerError.mock.calls.find(
        ([message]) => message === "doad_foo shortlist-prefetch research failed"
      );
      expect(failure?.[1]).toEqual({
        processingTime: expect.any(Number),
        questionLength: "Test question".length,
        errorName: "InferenceUpstreamError",
        aiUpstreamCode: 5006,
      });
      expect(JSON.stringify(failure?.[1])).not.toContain("sensitive");
      loggerError.mockRestore();
    });

    it("should allow intentional high-confidence none with an empty prefetch", async () => {
      clefAi = mockClefAi(shortlistResponse([], { group: "none" }));
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

    it("should throw when Clef answers are malformed", async () => {
      clefAi = {
        run: vi.fn(async () => ({
          model: "clef-flash",
          answers: {},
          usage: { input_tokens: 1, output_tokens: 0 },
        })),
      };
      agent = new DoadFooAgent(mockEnv, config, {
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

    it("should fail cleanly when the DOAD index is missing", async () => {
      mockBucket.delete("doad/index_v2.md");

      await expect(agent.research({ question: "Test question" })).rejects.toThrow();
      expect(clefAi.run).not.toHaveBeenCalled();
      expect(mockGenerateText).not.toHaveBeenCalled();
    });

    it("should reject when a shortlisted DOAD document cannot be retrieved", async () => {
      // group_2 doc_0 = 6000-1 is indexed but not seeded in R2
      clefAi = mockClefAi(shortlistResponse([{ choice: "doc_0" }], { group: "group_2" }));
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
