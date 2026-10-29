/**
 * tests/workers/setup.ts
 *
 * Workers-pool setup: default Clef / Clef-flash gates to allow so existing suites still hit Prime Foo / MemoryFoo.
 *
 * Top-level declarations:
 * - beforeEach hook: Intercepts Clef requests and delegates other models to the original binding.
 */

import { env } from "cloudflare:workers";
import { beforeEach, vi } from "vitest";

import {
  type ClefAiRunner,
  CLEF_FLASH_MODEL,
  CLEF_MODEL,
} from "../../src/agents/utils/ClefDecision";

beforeEach(() => {
  if (!env.AI) return;

  // SAFETY: The mock handles Clef requests missing from generated AiModels; other calls keep their original binding.
  const ai = env.AI as ClefAiRunner;
  const originalRun = ai.run.bind(ai);

  vi.spyOn(ai, "run").mockImplementation(async (model, inputs) => {
    if (model !== CLEF_FLASH_MODEL && model !== CLEF_MODEL) {
      return originalRun(model, inputs);
    }

    const questions = inputs.questions;

    const answers: Record<
      string,
      { type: string; choice: string; confidence: number; probabilities: Record<string, number> }
    > = {};

    if ("should_reply" in questions) {
      answers.should_reply = {
        type: "choice",
        choice: "reply",
        confidence: 1,
        probabilities: { reply: 1, no_reply: 0 },
      };
    }

    if ("should_update_memory" in questions) {
      answers.should_update_memory = {
        type: "choice",
        choice: "update",
        confidence: 1,
        probabilities: { update: 1, no_update: 0 },
      };
    }

    if (Object.keys(answers).length === 0) {
      answers.should_reply = {
        type: "choice",
        choice: "reply",
        confidence: 1,
        probabilities: { reply: 1, no_reply: 0 },
      };
    }

    return {
      model: "clef-flash",
      answers,
      usage: { input_tokens: 1, output_tokens: 1 },
    };
  });
});
