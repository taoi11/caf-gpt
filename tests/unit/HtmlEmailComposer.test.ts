/**
 * tests/unit/HtmlEmailComposer.test.ts
 *
 * Unit tests for the HTML reply body composer (agent answer only, no quoted history)
 *
 * Top-level declarations:
 * - HtmlEmailComposer suite: Verifies Outlook-style wrapper and absence of quoted history
 */

import { describe, expect, it } from "vitest";
import { HtmlEmailComposer } from "../../src/email/components/HtmlEmailComposer";

describe("HtmlEmailComposer", () => {
  const composer = new HtmlEmailComposer();

  describe("composeHtmlReply", () => {
    it("wraps the reply content in the Outlook-style document", () => {
      const replyContent = "<div class=MsoNormal><p>This is the reply content.</p></div>";
      const html = composer.composeHtmlReply(replyContent);

      expect(html).toContain("<html");
      expect(html).toContain("xmlns:o=");
      expect(html).toContain("<div class=WordSection1>");
      expect(html).toContain(replyContent);
    });

    it("keeps the signature footer that arrives inside the reply content", () => {
      const replyContent =
        '<p>Answer</p>\n<div class="MsoNormal">\n<br><br>\nCAF-GPT<br>\nSource Code:<br>\n<pre><code>https://github.com/taoi11/caf-gpt</code></pre>\nHow to use CAF-GPT:<br>\n<pre><code>https://caf-gpt.com</code></pre>\n</div>';
      const html = composer.composeHtmlReply(replyContent);

      expect(html).toContain("Source Code:");
      expect(html).toContain("https://github.com/taoi11/caf-gpt");
      expect(html).toContain("How to use CAF-GPT:");
    });

    it("never writes a quoted-history header block into the body", () => {
      const html = composer.composeHtmlReply("<p>Reply</p>");

      expect(html).not.toMatch(/<b>\s*(?:<span[^>]*>)?From:/);
      expect(html).not.toContain("<b>Sent:</b>");
      expect(html).not.toContain("<b>To:</b>");
      expect(html).not.toContain("<b>Subject:</b>");
      expect(html).not.toContain("border-top:solid #E1E1E1");
      // Only the reply content sits between the WordSection1 wrapper tags.
      expect(html).toMatch(/<div class=WordSection1>\n<p>Reply<\/p>\n<\/div>/);
    });
  });
});
