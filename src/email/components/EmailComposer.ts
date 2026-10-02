/**
 * src/email/components/EmailComposer.ts
 *
 * Email composition utilities for formatting quoted content
 *
 * Top-level declarations:
 * - formatQuotedContent: Format quoted content with Outlook-style attribution headers
 */

import type { ParsedEmailData } from "../types";

/**
 * Format quoted content with Outlook-style attribution headers.
 * @param originalMessage - Parsed inbound email whose headers/body are quoted
 */
export function formatQuotedContent(originalMessage: ParsedEmailData): string {
  // Create Outlook-style header block
  const separator = "________________________________";
  const from = `From: ${originalMessage.from}`;
  // Use UTC string for now as requested
  const sent = `Sent: ${originalMessage.date ? originalMessage.date.toUTCString() : "Unknown date"}`;
  const to = `To: ${originalMessage.to.join("; ")}`;
  const subject = `Subject: ${originalMessage.subject}`;

  let headers = `${separator}\n${from}\n${sent}\n${to}`;

  if (originalMessage.cc && originalMessage.cc.length > 0) {
    headers += `\nCc: ${originalMessage.cc.join("; ")}`;
  }

  headers += `\n${subject}\n`;

  // Append original body without '>' quoting
  const body = originalMessage.body || "";

  return `\n\n${headers}\n${body}`;
}
