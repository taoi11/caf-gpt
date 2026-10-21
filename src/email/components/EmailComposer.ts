/**
 * src/email/components/EmailComposer.ts
 *
 * Formats an inbound email as a plain-text thread-history block for model context. The block
 * is stored per thread (agents/utils/ThreadHistory) and is never written into reply bodies.
 *
 * Top-level declarations:
 * - formatQuotedContent: Format an inbound email as an attributed history block
 */

import type { ParsedEmailData } from "../types";

/**
 * Format an inbound email as an attributed history block (same layout the reply body used to
 * quote, so the model sees the same prior-turn text it did before).
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
