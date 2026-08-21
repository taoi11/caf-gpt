/**
 * tests/unit/EmailNormalizer.test.ts
 *
 * Unit tests for email address normalization
 *
 * Tests:
 * - Bare address lowercasing and trimming
 * - Display-name and angle-only form unwrapping
 * - Empty, null, and undefined inputs at the runtime boundary
 */

import { describe, expect, it } from "vitest";
import { normalizeEmailAddress } from "../../src/email/utils/EmailNormalizer";

describe("EmailNormalizer", () => {
  it("should lowercase and trim a bare address", () => {
    expect(normalizeEmailAddress("  Luffy@Forces.GC.CA ")).toBe("luffy@forces.gc.ca");
  });

  it("should unwrap a display-name form", () => {
    expect(normalizeEmailAddress("Dhaliwal, Luffy <Luffy@Forces.GC.CA>")).toBe(
      "luffy@forces.gc.ca"
    );
  });

  it("should unwrap an angle-only form", () => {
    expect(normalizeEmailAddress("<User@Domain.com>")).toBe("user@domain.com");
  });

  it("should return an empty string for an empty input", () => {
    expect(normalizeEmailAddress("")).toBe("");
  });

  it("should return an empty string for null and undefined inputs", () => {
    // SAFETY: the normalizer sits on the inbound email runtime boundary; assert
    // it fails closed to "" instead of throwing on null/undefined.
    expect(normalizeEmailAddress(null)).toBe("");
    expect(normalizeEmailAddress(undefined)).toBe("");
  });
});
