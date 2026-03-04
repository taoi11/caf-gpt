/**
 * tests/unit/Errors.test.ts
 *
 * Unit tests for error helpers
 *
 * Tests:
 * - isOpenRouterCreditsErrorMessage detects credit exhaustion errors
 * - isOpenRouterCreditsErrorMessage ignores non-credit errors
 */

import { describe, expect, it } from "vitest";
import { isOpenRouterCreditsErrorMessage } from "../../src/errors";

describe("isOpenRouterCreditsErrorMessage", () => {
  it("detects 402 credit exhaustion messages", () => {
    expect(
      isOpenRouterCreditsErrorMessage(
        "OpenRouter error 402: You can only afford 123 tokens with credit balance"
      )
    ).toBe(true);
  });

  it("detects max_tokens credit exhaustion messages", () => {
    expect(
      isOpenRouterCreditsErrorMessage(
        "402: requires more credits or max_tokens exceeds your remaining credit"
      )
    ).toBe(true);
  });

  it("detects OpenRouter credit wording without 402", () => {
    expect(
      isOpenRouterCreditsErrorMessage(
        "OpenRouter: requires more credits for this request. max_tokens too high."
      )
    ).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isOpenRouterCreditsErrorMessage("Validation failed: schema mismatch")).toBe(false);
  });
});
