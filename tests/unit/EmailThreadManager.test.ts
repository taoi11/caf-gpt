/**
 * tests/unit/EmailThreadManager.test.ts
 *
 * Unit tests for EmailThreadManager
 *
 * Tests:
 * - Building threading headers (In-Reply-To, References)
 * - References trimming to RFC limits
 * - Error handling for invalid inputs
 */

import { beforeEach, describe, expect, it } from "vitest";
import { EmailThreadManager } from "../../src/email/components/EmailThreadManager";
import { EmailThreadingError } from "../../src/errors";
import { createMockParsedEmail } from "../mocks";

describe("EmailThreadManager", () => {
  let manager: EmailThreadManager;

  beforeEach(() => {
    manager = new EmailThreadManager();
  });

  describe("buildThreadingHeaders", () => {
    it("should throw error when original message is null", () => {
      expect(() => manager.buildThreadingHeaders(null as never)).toThrow(EmailThreadingError);
    });

    it("should throw error when original message is undefined", () => {
      expect(() => manager.buildThreadingHeaders(undefined as never)).toThrow(EmailThreadingError);
    });

    it("should build headers with In-Reply-To when messageId is present", () => {
      const message = createMockParsedEmail({
        messageId: "<original@example.com>",
      });

      const headers = manager.buildThreadingHeaders(message);

      expect(headers.inReplyTo).toBe("<original@example.com>");
      expect(headers.references).toBe("<original@example.com>");
    });

    it("should build References from existing references and messageId", () => {
      const message = createMockParsedEmail({
        messageId: "<msg3@example.com>",
        references: "<msg1@example.com> <msg2@example.com>",
      });

      const headers = manager.buildThreadingHeaders(message);

      expect(headers.inReplyTo).toBe("<msg3@example.com>");
      expect(headers.references).toBe("<msg1@example.com> <msg2@example.com> <msg3@example.com>");
    });

    it("should return empty headers when messageId is missing", () => {
      const message = createMockParsedEmail({
        messageId: undefined,
      });

      const headers = manager.buildThreadingHeaders(message);

      expect(headers.inReplyTo).toBeUndefined();
      expect(headers.references).toBeUndefined();
    });

    it("should handle references with extra whitespace", () => {
      const message = createMockParsedEmail({
        messageId: "<msg2@example.com>",
        references: "  <msg1@example.com>  ",
      });

      const headers = manager.buildThreadingHeaders(message);

      expect(headers.references).toBe("<msg1@example.com> <msg2@example.com>");
    });
  });

  describe("trimReferences", () => {
    it("should return empty string for null input", () => {
      const result = manager.trimReferences(null as never, 1000);
      expect(result).toBe("");
    });

    it("should return empty string for undefined input", () => {
      const result = manager.trimReferences(undefined as never, 1000);
      expect(result).toBe("");
    });

    it("should return empty string for non-string input", () => {
      const result = manager.trimReferences(123 as never, 1000);
      expect(result).toBe("");
    });

    it("should return trimmed references unchanged if within length limit", () => {
      const refs = "<msg1@example.com> <msg2@example.com>";
      const result = manager.trimReferences(refs, 1000);
      expect(result).toBe(refs);
    });

    it("should keep most recent messages when exceeding length limit", () => {
      // Create references that exceed the limit
      const longRefs =
        "<msg1@very-long-domain-name.example.com> " +
        "<msg2@very-long-domain-name.example.com> " +
        "<msg3@very-long-domain-name.example.com>";

      const result = manager.trimReferences(longRefs, 80);

      // Should keep only the most recent messages that fit
      expect(result).toContain("<msg3@very-long-domain-name.example.com>");
      expect(result.length).toBeLessThanOrEqual(80);
    });

    it("should handle invalid message IDs during trimming", () => {
      const refs = "<valid1@example.com> invalid-id <valid2@example.com>";
      const result = manager.trimReferences(refs, 1000);

      expect(result).toBe(refs);
    });

    it("should work backwards from most recent messages", () => {
      const refs = "<msg1@example.com> <msg2@example.com> <msg3@example.com> <msg4@example.com>";

      // Set limit that can fit 2 messages
      const result = manager.trimReferences(refs, 50);

      // Should keep msg3 and msg4 (most recent)
      expect(result).toContain("<msg3@example.com>");
      expect(result).toContain("<msg4@example.com>");
      expect(result).not.toContain("<msg1@example.com>");
    });

    it("should handle empty string input", () => {
      const result = manager.trimReferences("", 1000);
      expect(result).toBe("");
    });

    it("should handle whitespace-only input", () => {
      const result = manager.trimReferences("   ", 1000);
      expect(result).toBe("");
    });

    it("should handle single message ID", () => {
      const refs = "<single@example.com>";
      const result = manager.trimReferences(refs, 1000);
      expect(result).toBe(refs);
    });

    it("should handle very small length limit", () => {
      const refs = "<msg1@example.com> <msg2@example.com>";
      const result = manager.trimReferences(refs, 10);

      // Should return empty if nothing fits
      expect(result.length).toBeLessThanOrEqual(10);
    });
  });

  describe("RFC 5322 Compliance", () => {
    it("should respect REFERENCES_MAX_LENGTH constant", () => {
      // Generate references longer than 1000 chars
      const longMessageIds: string[] = [];
      for (let i = 0; i < 30; i++) {
        longMessageIds.push(`<message-${i}@very-long-domain-name.example.com>`);
      }
      const longRefs = longMessageIds.join(" ");

      const message = createMockParsedEmail({
        messageId: "<final@example.com>",
        references: longRefs,
      });

      const headers = manager.buildThreadingHeaders(message);

      expect(headers.references).toBeDefined();
      expect(headers.references?.length).toBeLessThanOrEqual(1000);
    });

    it("should preserve thread continuity with recent messages", () => {
      const message = createMockParsedEmail({
        messageId: "<msg5@example.com>",
        references: "<msg1@example.com> <msg2@example.com> <msg3@example.com> <msg4@example.com>",
      });

      const headers = manager.buildThreadingHeaders(message);

      // Should always include the most recent message ID
      expect(headers.references).toContain("<msg5@example.com>");
    });
  });
});
