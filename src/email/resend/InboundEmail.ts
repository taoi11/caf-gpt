/**
 * src/email/resend/InboundEmail.ts
 *
 * Maps a Resend inbox email into CAF-GPT's ParsedEmailData. The body, headers, threading ids,
 * Date and full To/CC come from the original raw MIME (downloaded from Resend), parsed with
 * postal-mime exactly as the Cloudflare Email Routing path did, so quoting, Outlook threading,
 * loop guards and recipient policy see the same data. The "envelope" fields are the
 * Resend-authenticated From address and the inbox address the email arrived at.
 *
 * Top-level declarations:
 * - InboundEnvelope: Authenticated sender and receiving inbox address for one email
 * - buildEnvelopeEmailData: Minimal envelope-only metadata used before (or if) MIME parsing fails
 * - parseInboundEmail: Parses raw MIME into ParsedEmailData with the given envelope
 * - isSenderAuthenticated: Whether Resend's receive-time checks authenticate the From domain
 */

import PostalMime, { type Address, type Header } from "postal-mime";
import { formatOutlookMailbox } from "../components";
import type { ParsedEmailData } from "../types";
import { normalizeEmailAddress } from "../utils/EmailNormalizer";
import { htmlToText } from "../utils/HtmlToText";
import type { ReceivedEmailInfo } from "./ResendClient";

/** Authenticated sender and receiving inbox address for one email. */
export interface InboundEnvelope {
  /** RFC 5322 From address Resend authenticated (SPF/DKIM/DMARC computed on receipt). */
  from: string;
  /** Address of the Resend inbox the email arrived at. */
  to: string;
}

/** Extracts normalized mailbox addresses from parsed MIME address groups. */
function extractAddresses(addresses?: Address[]): string[] {
  if (!addresses) return [];

  return addresses.flatMap((entry) => {
    if (entry.group) {
      return entry.group.map((mailbox) => normalizeEmailAddress(mailbox.address));
    }

    return [normalizeEmailAddress(entry.address)];
  });
}

/** Lowercase header name to value (repeated headers joined with ", "). */
interface EmailHeaderMap {
  [headerName: string]: string;
}

/** Builds a lowercase header map; repeated headers are joined with ", ". */
function buildHeaderMap(headers: Header[]): EmailHeaderMap {
  const normalized: EmailHeaderMap = {};

  for (const header of headers) {
    const key = header.key.toLowerCase();
    normalized[key] = normalized[key] ? `${normalized[key]}, ${header.value}` : header.value;
  }

  return normalized;
}

/**
 * Minimal envelope-only metadata, used for logging and the error reply when MIME parsing fails.
 * @param envelope - Authenticated sender and receiving inbox address
 */
export function buildEnvelopeEmailData(envelope: InboundEnvelope): ParsedEmailData {
  const from = normalizeEmailAddress(envelope.from);
  const to = normalizeEmailAddress(envelope.to);

  return {
    envelopeFrom: from,
    envelopeTo: to,
    from,
    replyTo: [],
    replyToPresent: false,
    to: [to].filter(Boolean),
    cc: [],
    subject: "",
    body: "",
    date: new Date(),
  };
}

/**
 * Parses raw MIME into ParsedEmailData. The text body falls back to the HTML converted to text;
 * the quote headers keep display names and only a real Date header.
 * @param rawEmail - Original raw MIME from Resend's raw download URL
 * @param envelope - Authenticated sender and receiving inbox address
 */
export async function parseInboundEmail(
  rawEmail: Uint8Array,
  envelope: InboundEnvelope
): Promise<ParsedEmailData> {
  const parsed = await new PostalMime().parse(rawEmail);
  const headers = buildHeaderMap(parsed.headers);
  const rawTextBody = parsed.text ?? "";
  const rawHtmlBody = parsed.html;

  const derivedBody =
    rawTextBody.trim().length > 0 ? rawTextBody : rawHtmlBody ? htmlToText(rawHtmlBody) : "";

  const fromAddresses = extractAddresses(parsed.from ? [parsed.from] : undefined);

  return {
    envelopeFrom: normalizeEmailAddress(envelope.from),
    envelopeTo: normalizeEmailAddress(envelope.to),
    from: fromAddresses.length === 1 ? fromAddresses[0] : "",
    replyTo: extractAddresses(parsed.replyTo),
    replyToPresent: headers["reply-to"] !== undefined,
    to: extractAddresses(parsed.to),
    cc: extractAddresses(parsed.cc),
    subject: parsed.subject ?? "",
    headers,
    body: derivedBody,
    html: rawHtmlBody,
    messageId: parsed.messageId ?? headers["message-id"],
    inReplyTo: parsed.inReplyTo ?? headers["in-reply-to"],
    references: parsed.references ?? headers.references,
    date: parsed.date ? new Date(parsed.date) : new Date(),
    quoteHeaders: {
      from: formatOutlookMailbox(parsed.from ? [parsed.from] : undefined)[0] ?? "",
      to: formatOutlookMailbox(parsed.to),
      cc: formatOutlookMailbox(parsed.cc),
      // Only a real Date header; the quote never invents a Sent time.
      sent: parsed.date ? new Date(parsed.date) : undefined,
    },
  };
}

/**
 * Whether Resend's receive-time checks authenticate the From domain: DMARC pass, or an aligned
 * DKIM pass (Resend reports DKIM `gray` when the signing domain does not match From). Missing
 * results (null) are treated as unauthenticated, so the email is never answered.
 * @param authentication - authentication from GET /emails/receiving/{id}
 */
export function isSenderAuthenticated(
  authentication: ReceivedEmailInfo["authentication"]
): boolean {
  if (!authentication) return false;

  return authentication.dmarc === "pass" || authentication.dkim === "pass";
}
