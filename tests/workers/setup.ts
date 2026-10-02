/**
 * tests/workers/setup.ts
 *
 * Workers-pool setup: default Clef-flash reply gate to allow so existing suites still hit Prime Foo
 */

import { env } from "cloudflare:workers";
import { beforeEach, vi } from "vitest";

import { CLEF_FLASH_MODEL } from "../../src/agents/utils/ClefDecision";

beforeEach(() => {
  if (!env.AI || typeof env.AI.run !== "function") {
    return;
  }

  const ai = env.AI as { run: (...args: unknown[]) => Promise<unknown> };
  vi.spyOn(ai, "run").mockImplementation(async (model: unknown, ...rest: unknown[]) => {
    if (model === CLEF_FLASH_MODEL) {
      return {
        model: "clef-flash",
        answers: {
          should_reply: {
            type: "choice",
            choice: "reply",
            confidence: 1,
            probabilities: { reply: 1, no_reply: 0 },
          },
        },
        usage: { input_tokens: 1, output_tokens: 1 },
      };
    }

    // Preserve non-Clef AI.run usage if a test (or future code) needs the real binding.
    const unbound = (
      Object.getPrototypeOf(ai) as { run?: (...args: unknown[]) => Promise<unknown> }
    ).run;
    if (typeof unbound === "function") {
      return unbound.call(ai, model, ...rest);
    }
    throw new Error(`Unexpected AI.run model in workers tests: ${String(model)}`);
  });
});
