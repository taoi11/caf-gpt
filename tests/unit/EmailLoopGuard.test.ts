/**
 * tests/unit/EmailLoopGuard.test.ts
 *
 * Unit tests for auto-reply detection utilities
 *
 * Tests:
 * - Detect auto-submitted replies
 * - Detect precedence bulk/list/junk
 * - Detect delivery status content types
 * - Detect auto-reply headers
 * - Avoid false positives on subject-only signals
 * - Expose only log-safe categories and allowlisted header names
 */

import { describe, expect, it } from "vitest";
import { detectAutoReply } from "../../src/email/utils/EmailLoopGuard";
import { createMockParsedEmail } from "../mocks";

describe("EmailLoopGuard", () => {
  it("should ignore emails with Auto-Submitted header", () => {
    const email = createMockParsedEmail({
      headers: { "Auto-Submitted": "auto-replied" },
    });

    const result = detectAutoReply(email);
    expect(result.ignore).toBe(true);
    expect(result.reasons.join(" ")).toMatch(/Auto-Submitted/i);
  });

  it("should ignore emails with Precedence bulk", () => {
    const email = createMockParsedEmail({
      headers: { Precedence: "bulk" },
    });

    const result = detectAutoReply(email);
    expect(result.ignore).toBe(true);
    expect(result.reasons.join(" ")).toMatch(/Precedence/i);
  });

  it("should ignore emails with delivery status content-type", () => {
    const email = createMockParsedEmail({
      headers: { "Content-Type": "multipart/report; report-type=delivery-status" },
    });

    const result = detectAutoReply(email);
    expect(result.ignore).toBe(true);
    expect(result.reasons.join(" ")).toMatch(/Content-Type/i);
  });

  it("should ignore emails with auto-reply headers", () => {
    const email = createMockParsedEmail({
      headers: { "X-AutoReply": "yes" },
    });

    const result = detectAutoReply(email);
    expect(result.ignore).toBe(true);
    expect(result.reasons.join(" ")).toMatch(/Auto-reply headers/i);
  });

  it("should not ignore subject-only auto-reply patterns", () => {
    const email = createMockParsedEmail({
      subject: "Out of office reply",
      headers: {},
    });

    const result = detectAutoReply(email);
    expect(result.ignore).toBe(false);
  });

  it("should include low-confidence reasons when high-confidence match exists", () => {
    const email = createMockParsedEmail({
      subject: "Out of office reply",
      headers: { "Auto-Submitted": "auto-replied" },
    });

    const result = detectAutoReply(email);
    expect(result.ignore).toBe(true);
    expect(result.reasons.join(" ")).toMatch(/Subject/i);
  });

  it("exposes log-safe categories and allowlisted header names", () => {
    const email = createMockParsedEmail({
      subject: "Automatic reply: secret subject",
      from: "noreply@forces.gc.ca",
      headers: {
        "Auto-Submitted": "auto-replied (secret)",
        "X-Auto-Response-Suppress": "All",
        Precedence: "bulk",
      },
    });

    const result = detectAutoReply(email);
    expect(result.ignore).toBe(true);
    expect(result.categories).toEqual([
      "auto_submitted",
      "precedence",
      "auto_reply_header",
      "subject_pattern",
      "sender_pattern",
    ]);
    expect(result.matchedHeaders).toEqual(["auto-submitted", "x-auto-response-suppress"]);
    const logSafe = JSON.stringify({ c: result.categories, h: result.matchedHeaders });
    expect(logSafe).not.toMatch(/secret|noreply@|forces\.gc\.ca/);
  });

  it("returns empty categories when not ignored", () => {
    const result = detectAutoReply(createMockParsedEmail({ headers: {} }));
    expect(result).toEqual({ ignore: false, reasons: [], categories: [], matchedHeaders: [] });
  });
});
