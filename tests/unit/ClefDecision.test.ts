/**
 * tests/unit/ClefDecision.test.ts
 *
 * Unit tests for the Clef-flash reply vs no_reply gate helper
 */

import { describe, expect, it, vi } from "vitest";

import {
  CLEF_FLASH_MODEL,
  CLEF_REPLY_CONFIDENCE_THRESHOLD,
  type ClefAiRunner,
  decideShouldReply,
} from "../../src/agents/utils/ClefDecision";

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
    const ai = mockAi({ model: "clef-flash", answers: {}, usage: { input_tokens: 1, output_tokens: 0 } });

    await expect(decideShouldReply(ai, "Question")).resolves.toEqual({
      shouldReply: false,
      reason: "clef_malformed_answer",
    });
  });
});
