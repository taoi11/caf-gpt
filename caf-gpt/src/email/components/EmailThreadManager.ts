/**
 * src/email/components/EmailThreadManager.ts
 *
 * Email threading headers per RFC 5322
 *
 * Top-level declarations:
 * - EmailThreadManager: Manage RFC-compliant threading headers
 * - buildThreadingHeaders: Build threading headers for reply emails
 * - trimReferences: Trim References header to stay within length limits
 */

import { EmailThreadingError } from "../../errors";
import type { ParsedEmailData, ThreadingHeaders } from "../types";
import { isValidMessageId } from "../utils/EmailValidator";

// Manage RFC-compliant threading headers
export class EmailThreadManager {
  private static readonly REFERENCES_MAX_LENGTH = 1000;

  // Build threading headers for reply emails
  buildThreadingHeaders(originalMessage: ParsedEmailData): ThreadingHeaders {
    if (!originalMessage) {
      throw new EmailThreadingError("Original message is required for threading headers");
    }

    const headers: ThreadingHeaders = {};

    // Set In-Reply-To to the original message's Message-ID
    if (originalMessage.messageId) {
      headers.inReplyTo = originalMessage.messageId;

      // Build References header by combining existing references with the original Message-ID
      let refs = "";
      if (originalMessage.references) {
        // Append original Message-ID to existing references
        refs = `${originalMessage.references.trim()} ${originalMessage.messageId}`;
      } else {
        // Start new references chain with original Message-ID
        refs = originalMessage.messageId;
      }

      headers.references = this.trimReferences(refs, EmailThreadManager.REFERENCES_MAX_LENGTH);
    }

    return headers;
  }

  // Trim References header to stay within length limits
  trimReferences(references: string, maxLength: number): string {
    if (!references || typeof references !== "string") {
      return "";
    }

    const trimmedRefs = references.trim();

    if (trimmedRefs.length <= maxLength) {
      return trimmedRefs;
    }

    // Simple truncation: keep the most recent messages that fit
    // Email clients primarily use the last few references for threading anyway
    const messageIds = trimmedRefs
      .split(/\s+/)
      .filter((id) => id.length > 0 && isValidMessageId(id));

    // Work backwards from most recent, keeping as many as fit
    const kept: string[] = [];
    let currentLength = 0;

    for (let i = messageIds.length - 1; i >= 0; i--) {
      const messageId = messageIds[i];
      const neededLength = currentLength + (kept.length > 0 ? 1 : 0) + messageId.length;

      if (neededLength <= maxLength) {
        kept.unshift(messageId);
        currentLength = neededLength;
      } else {
        break;
      }
    }

    return kept.join(" ");
  }
}
