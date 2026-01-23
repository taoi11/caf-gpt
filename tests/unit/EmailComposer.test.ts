import { describe, expect, it } from "vitest";
import { EmailComposer } from "../../src/email/components/EmailComposer";
import { createMockParsedEmail } from "../mocks/email";

describe("EmailComposer", () => {
  const composer = new EmailComposer();

  describe("formatQuotedContent", () => {
    it("should format content with Outlook-style headers", () => {
      const originalMessage = createMockParsedEmail({
        from: "sender@example.com",
        to: ["recipient@example.com"],
        cc: [],
        subject: "Original Subject",
        date: new Date("2024-01-01T12:00:00Z"),
        body: "Original message body.\nLine 2.",
      });

      const formatted = composer.formatQuotedContent(originalMessage);

      // Expect separator line
      expect(formatted).toContain("________________________________");

      // Expect headers
      expect(formatted).toContain("From: sender@example.com");
      expect(formatted).toContain("Sent: Mon, 01 Jan 2024 12:00:00 GMT"); // matching toUTCString() format for now
      expect(formatted).toContain("To: recipient@example.com");
      expect(formatted).toContain("Subject: Original Subject");

      // Expect body without '>' quoting
      expect(formatted).toContain("Original message body.");
      expect(formatted).toContain("Line 2.");
      expect(formatted).not.toMatch(/^> /m); // Should not start lines with '> '
    });

    it("should include Cc header when present", () => {
      const originalMessage = createMockParsedEmail({
        cc: ["cc1@example.com", "cc2@example.com"],
      });

      const formatted = composer.formatQuotedContent(originalMessage);

      expect(formatted).toContain("Cc: cc1@example.com; cc2@example.com");
    });

    it("should separate multiple recipients with semi-colons", () => {
      const originalMessage = createMockParsedEmail({
        to: ["to1@example.com", "to2@example.com"],
      });

      const formatted = composer.formatQuotedContent(originalMessage);

      expect(formatted).toContain("To: to1@example.com; to2@example.com");
    });

    it("should handle missing body gracefully", () => {
      const originalMessage = createMockParsedEmail({
        body: "",
      });
      const formatted = composer.formatQuotedContent(originalMessage);

      expect(formatted).toContain("From: ");
      expect(formatted).not.toContain("Original message body.");
    });
  });
});
