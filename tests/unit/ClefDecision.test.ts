/**
 * tests/unit/ClefDecision.test.ts
 *
 * Unit tests for Clef-flash reply and memory-update gate helpers
 *
 * Top-level declarations:
 * - choiceAnswer: Builds a Clef choice answer fixture for should_reply
 * - memoryChoiceAnswer: Builds a Clef choice answer fixture for should_update_memory
 * - mockAi: Returns a ClefAiRunner whose run() resolves to the given result
 * - shortlistManifestFiles describe block: Unit coverage for DOAD/QR&O shortlist helper
 */

import { describe, expect, it, vi } from "vitest";

import {
  CLEF_FLASH_MODEL,
  CLEF_MEMORY_UPDATE_CONFIDENCE_THRESHOLD,
  CLEF_REPLY_CONFIDENCE_THRESHOLD,
  CLEF_SHORTLIST_CONFIDENCE_THRESHOLD,
  type ClefAiRunner,
  decideShouldReply,
  decideShouldUpdateMemory,
  shortlistManifestFiles,
} from "../../src/agents/utils/ClefDecision";

/** Builds a Clef choice answer fixture for should_reply. */
function choiceAnswer(choice: string, confidence: number) {
  return {
    type: "choice",
    choice,
    confidence,
    probabilities: {
      reply: choice === "reply" ? confidence : 1 - confidence,
      no_reply: choice === "no_reply" ? confidence : 1 - confidence,
    },
  };
}

/** Builds a Clef choice answer fixture for should_update_memory. */
function memoryChoiceAnswer(choice: string, confidence: number) {
  return {
    type: "choice",
    choice,
    confidence,
    probabilities: {
      update: choice === "update" ? confidence : 1 - confidence,
      no_update: choice === "no_update" ? confidence : 1 - confidence,
    },
  };
}

/** Returns a ClefAiRunner whose run() resolves to the given result. */
function mockAi(result: unknown): ClefAiRunner {
  return {
    run: vi.fn(async () => result),
  };
}

describe("decideShouldReply", () => {
  it("continues when Clef chooses reply above the confidence threshold", async () => {
    const ai = mockAi({
      model: "clef-flash",
      answers: { should_reply: choiceAnswer("reply", 0.91) },
      usage: { input_tokens: 10, output_tokens: 1 },
    });

    await expect(decideShouldReply(ai, "Subject: Leave\n\nCan I take leave?")).resolves.toEqual({
      shouldReply: true,
      choice: "reply",
      confidence: 0.91,
      reason: "clef_reply",
    });

    expect(ai.run).toHaveBeenCalledWith(
      CLEF_FLASH_MODEL,
      expect.objectContaining({
        model: "clef-flash",
        state: "Subject: Leave\n\nCan I take leave?",
        questions: {
          should_reply: expect.objectContaining({ type: "choice" }),
        },
      })
    );
  });

  it("includes non-empty user memory in Clef state", async () => {
    const ai = mockAi({
      model: "clef-flash",
      answers: { should_reply: choiceAnswer("reply", 0.9) },
      usage: { input_tokens: 10, output_tokens: 1 },
    });

    await decideShouldReply(ai, "Subject: Re\n\nYes, please", "User prefers leave drafting help.");

    expect(ai.run).toHaveBeenCalledWith(
      CLEF_FLASH_MODEL,
      expect.objectContaining({
        state: expect.stringContaining("<memory>\nUser prefers leave drafting help.\n</memory>"),
      })
    );
    expect(ai.run).toHaveBeenCalledWith(
      CLEF_FLASH_MODEL,
      expect.objectContaining({
        state: expect.stringContaining("Yes, please"),
      })
    );
  });

  it("omits memory tags when memory is empty", async () => {
    const ai = mockAi({
      model: "clef-flash",
      answers: { should_reply: choiceAnswer("reply", 0.9) },
      usage: { input_tokens: 10, output_tokens: 1 },
    });

    await decideShouldReply(ai, "Subject: Hi\n\nHello", "   ");

    expect(ai.run).toHaveBeenCalledWith(
      CLEF_FLASH_MODEL,
      expect.objectContaining({
        state: "Subject: Hi\n\nHello",
      })
    );
  });

  it("skips when Clef chooses no_reply", async () => {
    const ai = mockAi({
      model: "clef-flash",
      answers: { should_reply: choiceAnswer("no_reply", 0.88) },
      usage: { input_tokens: 10, output_tokens: 1 },
    });

    await expect(decideShouldReply(ai, "Thanks!")).resolves.toEqual({
      shouldReply: false,
      choice: "no_reply",
      confidence: 0.88,
      reason: "clef_no_reply",
    });
  });

  it("fails closed when reply confidence is below the threshold", async () => {
    const low = Math.max(0, CLEF_REPLY_CONFIDENCE_THRESHOLD - 0.05);
    const ai = mockAi({
      model: "clef-flash",
      answers: { should_reply: choiceAnswer("reply", low) },
      usage: { input_tokens: 10, output_tokens: 1 },
    });

    await expect(decideShouldReply(ai, "Maybe actionable?")).resolves.toEqual({
      shouldReply: false,
      choice: "reply",
      confidence: low,
      reason: "clef_low_confidence",
    });
  });

  it("propagates AI.run outages instead of silent no_reply", async () => {
    const ai: ClefAiRunner = {
      run: vi.fn(async () => {
        throw new Error("workers ai down");
      }),
    };

    await expect(decideShouldReply(ai, "Question")).rejects.toThrow("workers ai down");
  });

  it("fails closed on malformed answers", async () => {
    const ai = mockAi({
      model: "clef-flash",
      answers: {},
      usage: { input_tokens: 1, output_tokens: 0 },
    });

    await expect(decideShouldReply(ai, "Question")).resolves.toEqual({
      shouldReply: false,
      reason: "clef_malformed_answer",
    });
  });

  it("fails closed on out-of-range confidence", async () => {
    const ai = mockAi({
      model: "clef-flash",
      answers: { should_reply: choiceAnswer("reply", 1.2) },
      usage: { input_tokens: 1, output_tokens: 0 },
    });

    await expect(decideShouldReply(ai, "Question")).resolves.toEqual({
      shouldReply: false,
      reason: "clef_malformed_answer",
    });
  });
});

describe("decideShouldUpdateMemory", () => {
  it("continues when Clef chooses update above the confidence threshold", async () => {
    const ai = mockAi({
      model: "clef-flash",
      answers: { should_update_memory: memoryChoiceAnswer("update", 0.92) },
      usage: { input_tokens: 10, output_tokens: 1 },
    });

    await expect(
      decideShouldUpdateMemory(
        ai,
        "Subject: Leave\n\nI am a Corporal in engineers.",
        "Here is leave guidance."
      )
    ).resolves.toEqual({
      shouldUpdate: true,
      choice: "update",
      confidence: 0.92,
      reason: "clef_update",
    });

    expect(ai.run).toHaveBeenCalledWith(
      CLEF_FLASH_MODEL,
      expect.objectContaining({
        model: "clef-flash",
        state: expect.stringContaining("<user_email>"),
        questions: {
          should_update_memory: expect.objectContaining({ type: "choice" }),
        },
      })
    );
  });

  it("includes memory, email, and agent reply in Clef state", async () => {
    const ai = mockAi({
      model: "clef-flash",
      answers: { should_update_memory: memoryChoiceAnswer("update", 0.9) },
      usage: { input_tokens: 10, output_tokens: 1 },
    });

    await decideShouldUpdateMemory(
      ai,
      "Subject: Pref\n\nPlease keep answers short.",
      "Understood — I will keep answers concise.",
      "User asks about leave often."
    );

    expect(ai.run).toHaveBeenCalledWith(
      CLEF_FLASH_MODEL,
      expect.objectContaining({
        state: expect.stringContaining("<memory>\nUser asks about leave often.\n</memory>"),
      })
    );
    expect(ai.run).toHaveBeenCalledWith(
      CLEF_FLASH_MODEL,
      expect.objectContaining({
        state: expect.stringContaining("Please keep answers short."),
      })
    );
    expect(ai.run).toHaveBeenCalledWith(
      CLEF_FLASH_MODEL,
      expect.objectContaining({
        state: expect.stringContaining("I will keep answers concise."),
      })
    );
  });

  it("skips when Clef chooses no_update", async () => {
    const ai = mockAi({
      model: "clef-flash",
      answers: { should_update_memory: memoryChoiceAnswer("no_update", 0.87) },
      usage: { input_tokens: 10, output_tokens: 1 },
    });

    await expect(decideShouldUpdateMemory(ai, "Thanks", "You're welcome.")).resolves.toEqual({
      shouldUpdate: false,
      choice: "no_update",
      confidence: 0.87,
      reason: "clef_no_update",
    });
  });

  it("fails closed when update confidence is below the threshold", async () => {
    const low = Math.max(0, CLEF_MEMORY_UPDATE_CONFIDENCE_THRESHOLD - 0.05);
    const ai = mockAi({
      model: "clef-flash",
      answers: { should_update_memory: memoryChoiceAnswer("update", low) },
      usage: { input_tokens: 10, output_tokens: 1 },
    });

    await expect(decideShouldUpdateMemory(ai, "Maybe new?", "Reply")).resolves.toEqual({
      shouldUpdate: false,
      choice: "update",
      confidence: low,
      reason: "clef_low_confidence",
    });
  });

  it("propagates AI.run outages instead of silent no_update", async () => {
    const ai: ClefAiRunner = {
      run: vi.fn(async () => {
        throw new Error("workers ai down");
      }),
    };

    await expect(decideShouldUpdateMemory(ai, "Question", "Answer")).rejects.toThrow(
      "workers ai down"
    );
  });

  it("fails closed on malformed answers", async () => {
    const ai = mockAi({
      model: "clef-flash",
      answers: {},
      usage: { input_tokens: 1, output_tokens: 0 },
    });

    await expect(decideShouldUpdateMemory(ai, "Question", "Answer")).resolves.toEqual({
      shouldUpdate: false,
      reason: "clef_malformed_answer",
    });
  });

  it("fails closed on out-of-range confidence", async () => {
    const ai = mockAi({
      model: "clef-flash",
      answers: { should_update_memory: memoryChoiceAnswer("update", 1.2) },
      usage: { input_tokens: 1, output_tokens: 0 },
    });

    await expect(decideShouldUpdateMemory(ai, "Question", "Answer")).resolves.toEqual({
      shouldUpdate: false,
      reason: "clef_malformed_answer",
    });
  });
});

describe("shortlistManifestFiles", () => {
  const rows = [
    { id: "5019-0", title: "Conduct", file: "5019-0.md" },
    { id: "5031-1", title: "Grievance", file: "5031-1.md" },
    { id: "7023-1", title: "Relocation", file: "7023-1.md" },
  ];

  /** Builds a shortlist choice answer for a pick slot. */
  function shortlistChoice(choice: string, confidence: number) {
    return {
      type: "choice",
      choice,
      confidence,
      probabilities: { [choice]: confidence },
    };
  }

  it("returns allowlisted ids for high-confidence ranked picks", async () => {
    const ai = mockAi({
      model: "clef-flash",
      answers: {
        pick_1: shortlistChoice("doc_0", 0.95),
        pick_2: shortlistChoice("doc_2", 0.88),
        pick_3: shortlistChoice("none", 0.9),
      },
    });

    await expect(shortlistManifestFiles(ai, "conduct policy?", rows)).resolves.toEqual({
      ids: ["5019-0", "7023-1"],
      reason: "clef_shortlist",
    });

    expect(ai.run).toHaveBeenCalledWith(
      CLEF_FLASH_MODEL,
      expect.objectContaining({
        model: "clef-flash",
        state: expect.stringContaining("conduct policy?"),
        questions: expect.objectContaining({
          pick_1: expect.objectContaining({ type: "choice" }),
          pick_2: expect.objectContaining({ type: "choice" }),
          pick_3: expect.objectContaining({ type: "choice" }),
        }),
      })
    );
  });

  it("rejects invented option keys that are not in the allowlist map", async () => {
    const ai = mockAi({
      model: "clef-flash",
      answers: {
        pick_1: shortlistChoice("not_a_real_doc", 0.99),
        pick_2: shortlistChoice("doc_1", 0.9),
        pick_3: shortlistChoice("none", 0.9),
      },
    });

    await expect(shortlistManifestFiles(ai, "grievance?", rows)).resolves.toEqual({
      ids: ["5031-1"],
      reason: "clef_shortlist",
    });
  });

  it("fails closed to empty when pick confidence is below the threshold", async () => {
    const low = Math.max(0, CLEF_SHORTLIST_CONFIDENCE_THRESHOLD - 0.05);
    const ai = mockAi({
      model: "clef-flash",
      answers: {
        pick_1: shortlistChoice("doc_0", low),
        pick_2: shortlistChoice("none", 0.9),
        pick_3: shortlistChoice("none", 0.9),
      },
    });

    await expect(shortlistManifestFiles(ai, "maybe?", rows)).resolves.toEqual({
      ids: [],
      reason: "clef_empty_shortlist",
    });
  });

  it("propagates AI.run outages instead of returning an empty shortlist", async () => {
    const ai: ClefAiRunner = {
      run: vi.fn(async () => {
        throw new Error("workers ai down");
      }),
    };

    await expect(shortlistManifestFiles(ai, "question", rows)).rejects.toThrow("workers ai down");
  });

  it("fails closed on malformed answers", async () => {
    const ai = mockAi({
      model: "clef-flash",
      answers: {},
      usage: { input_tokens: 1, output_tokens: 0 },
    });

    await expect(shortlistManifestFiles(ai, "question", rows)).resolves.toEqual({
      ids: [],
      reason: "clef_malformed_answer",
    });
  });

  it("returns empty for an empty manifest without calling AI", async () => {
    const ai = mockAi({ model: "clef-flash", answers: {} });
    await expect(shortlistManifestFiles(ai, "question", [])).resolves.toEqual({
      ids: [],
      reason: "clef_empty_manifest",
    });
    expect(ai.run).not.toHaveBeenCalled();
  });
});
