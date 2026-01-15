/**
 * src/email/components/EmailComposer.ts
 *
 * Email composition utilities for formatting quoted content
 *
 * Top-level declarations:
 * - EmailComposer: Utility class for email composition
 * - formatQuotedContent: Format quoted content with attribution
 */

import type { ParsedEmailData } from "../types";

// Utility class for email composition
export class EmailComposer {
  // Format quoted content with attribution
  formatQuotedContent(originalMessage: ParsedEmailData): string {
    if (!originalMessage.body) {
      return "";
    }

    // Create attribution line
    const fromAddress = originalMessage.from;
    const date = originalMessage.date ? originalMessage.date.toLocaleString() : "Unknown date";
    const attribution = `On ${date}, ${fromAddress} wrote:`;

    // Format the quoted content with proper indentation
    const quotedLines = originalMessage.body
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");

    return `\n\n${attribution}\n${quotedLines}`;
  }
}
