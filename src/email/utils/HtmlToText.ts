/**
 * src/email/utils/HtmlToText.ts
 *
 * HTML-to-text conversion utilities for inbound parsing and text/plain fallbacks.
 *
 * Top-level declarations:
 * - htmlToText: Converts HTML into readable plain text using html-to-text
 */

import { type HtmlToTextOptions, htmlToText as htmlToTextLib } from "html-to-text";

const DEFAULT_HTML_TO_TEXT_OPTIONS: HtmlToTextOptions = {
  wordwrap: false,
  decodeEntities: true,
  selectors: [
    {
      selector: "a",
      options: {
        hideLinkHrefIfSameAsText: true,
        linkBrackets: ["(", ")"],
      },
    },
  ],
};

/**
 * Converts HTML content into a plain-text approximation suitable for:
 * - extracting content from HTML-only inbound emails
 * - generating text/plain fallbacks for outbound multipart replies
 */
export function htmlToText(html: string): string {
  if (!html) {
    return "";
  }

  try {
    const text = htmlToTextLib(html, DEFAULT_HTML_TO_TEXT_OPTIONS);
    return text.replace(/\n{3,}/g, "\n\n").trim();
  } catch {
    return html
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
}
