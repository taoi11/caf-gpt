/**
 * tests/unit/HtmlEmailComposer.test.ts
 *
 * Unit tests for the HTML reply body composer (answer and signature, then quoted history)
 *
 * Top-level declarations:
 * - HtmlEmailComposer suite: Verifies the Outlook-style wrapper and quote placement below the signature
 */

import { describe, expect, it } from "vitest";
import { HtmlEmailComposer } from "../../src/email/components/HtmlEmailComposer";

const QUOTE = "<div style='border:none;border-top:solid #E1E1E1 1.0pt'>QUOTE-BLOCK</div>";

describe("HtmlEmailComposer", () => {
  const composer = new HtmlEmailComposer();

  describe("composeHtmlReply", () => {
    it("wraps the reply content in the Outlook-style document", () => {
      const replyContent = "<div class=MsoNormal><p>This is the reply content.</p></div>";
      const html = composer.composeHtmlReply(replyContent, QUOTE);

      expect(html).toContain("<html");
      expect(html).toContain("xmlns:o=");
      expect(html).toContain("<div class=WordSection1>");
      expect(html).toContain(replyContent);
    });

    it("places the quoted history after the signature inside WordSection1", () => {
      const replyContent =
        '<p>Answer</p>\n<div class="MsoNormal">\n<br><br>\nCAF-GPT<br>\nSource Code:<br>\n<pre><code>https://github.com/taoi11/caf-gpt</code></pre>\nHow to use CAF-GPT:<br>\n<pre><code>https://caf-gpt.com</code></pre>\n</div>';
      const html = composer.composeHtmlReply(replyContent, QUOTE);

      expect(html).toContain("Source Code:");
      expect(html).toContain("https://github.com/taoi11/caf-gpt");
      expect(html.indexOf("How to use CAF-GPT:")).toBeLessThan(html.indexOf("QUOTE-BLOCK"));
      expect(html).toMatch(
        /<div class=WordSection1>\n<p>Answer<\/p>[\s\S]*<\/div>\n<div style='border:none[^']*'>QUOTE-BLOCK<\/div>\n<\/div>\n<\/body>/
      );
    });
  });
});
