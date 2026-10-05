/**
 * tests/workers/setup.ts
 *
 * Workers-pool setup: default Clef-flash gates to allow so existing suites still hit Prime Foo / MemoryFoo
 */

import { env } from "cloudflare:workers";
import { beforeEach, vi } from "vitest";

import { CLEF_FLASH_MODEL } from "../../src/agents/utils/ClefDecision";

beforeEach(() => {
  if (!env.AI || typeof env.AI.run !== "function") {
    return;
  }

  const ai = env.AI as { run: (...args: unknown[]) => Promise<unknown> };
  vi.spyOn(ai, "run").mockImplementation(async (model: unknown, inputs?: unknown) => {
    if (model === CLEF_FLASH_MODEL) {
      const questions =
        typeof inputs === "object" &&
        inputs !== null &&
        "questions" in inputs &&
        typeof (inputs as { questions: unknown }).questions === "object" &&
        (inputs as { questions: unknown }).questions !== null
          ? (inputs as { questions: Record<string, unknown> }).questions
          : {};

      const answers: Record<string, unknown> = {};
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
    }

    // Preserve non-Clef AI.run usage if a test (or future code) needs the real binding.
    const unbound = (
      Object.getPrototypeOf(ai) as { run?: (...args: unknown[]) => Promise<unknown> }
    ).run;
    if (typeof unbound === "function") {
      return unbound.call(ai, model, inputs);
    }
    throw new Error(`Unexpected AI.run model in workers tests: ${String(model)}`);
  });
});
