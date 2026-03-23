/**
 * tests/unit/Errors.test.ts
 *
 * Unit tests for error helpers
 *
 * Tests:
 * - isWorkersAINeuronLimitError detects neuron limit errors
 * - isWorkersAINeuronLimitError ignores non-neuron errors
 */

import { describe, expect, it } from "vitest";
import { isWorkersAINeuronLimitError } from "../../src/errors";

describe("isWorkersAINeuronLimitError", () => {
  it("detects neuron limit exceeded messages", () => {
    expect(isWorkersAINeuronLimitError("You have exceeded the neurons limit for today")).toBe(true);
  });

  it("detects 429 with neuron messages", () => {
    expect(isWorkersAINeuronLimitError("429: neuron budget exhausted, try again tomorrow")).toBe(
      true
    );
  });

  it("detects 429 with rate limit messages", () => {
    expect(isWorkersAINeuronLimitError("HTTP 429: rate limit exceeded for this account")).toBe(
      true
    );
  });

  it("detects 429 with quota messages", () => {
    expect(isWorkersAINeuronLimitError("429: daily quota reached")).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isWorkersAINeuronLimitError("Validation failed: schema mismatch")).toBe(false);
  });
});
