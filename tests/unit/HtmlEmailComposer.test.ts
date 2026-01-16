
import { describe, expect, it } from "vitest";
import { HtmlEmailComposer } from "../../src/email/components/HtmlEmailComposer";
import { createMockParsedEmail } from "../mocks/email";

describe("HtmlEmailComposer", () => {
  const composer = new HtmlEmailComposer();

  describe("composeHtmlReply", () => {
    it("should generate valid HTML structure", () => {
      const originalEmail = createMockParsedEmail({
        from: "sender@example.com",
        to: ["recipient@example.com"],
        subject: "Test Subject",
        body: "Original plain text body",
        html: "<p>Original HTML body</p>",
        date: new Date("2024-01-01T12:00:00Z"),
      });

      const replyContent = "<div class=MsoNormal><p>This is the reply content.</p></div>";
      const html = composer.composeHtmlReply(originalEmail, replyContent);

      // Check for key HTML elements
      expect(html).toContain("<html");
      expect(html).toContain("xmlns:o=");
      expect(html).toContain("class=MsoNormal");

      // Check for reply content
      expect(html).toContain(replyContent);

      // Check for Reply Header components
      // Note: Labels and values are separated by tags/spaces, so check separately
      expect(html).toContain("From:</span></b>");
      expect(html).toContain("sender@example.com");

      expect(html).toContain("To:</b>");
      expect(html).toContain("recipient@example.com");

      expect(html).toContain("Subject:</b>");
      expect(html).toContain("Test Subject");

      // Check for original body
      expect(html).toContain("<p>Original HTML body</p>");
    });

    it("should pass through HTML content directly", () => {
      const originalEmail = createMockParsedEmail({
        from: "sender@example.com",
      });

      const replyContent =
        "<div class=MsoNormal><p>Line 1.</p><p>Line 2.</p></div>";
      const html = composer.composeHtmlReply(originalEmail, replyContent);

      expect(html).toContain(replyContent);
    });

    it("should fallback to wrapping plain text if original HTML is missing", () => {
      const originalEmail = createMockParsedEmail({
        body: "Plain text line 1\nPlain text line 2",
        html: undefined, // Simulating no HTML
      });

      const html = composer.composeHtmlReply(originalEmail, "Reply");

      expect(html).toContain("<p class=MsoNormal>Plain text line 1</p>");
      expect(html).toContain("<p class=MsoNormal>Plain text line 2</p>");
    });

    it("should include CC in headers if present", () => {
        const originalEmail = createMockParsedEmail({
            cc: ["cc1@example.com", "cc2@example.com"]
        });

        const html = composer.composeHtmlReply(originalEmail, "Reply");
        expect(html).toContain("Cc:</b> cc1@example.com; cc2@example.com");
    });
  });
});
