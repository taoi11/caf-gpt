/**
 * src/email/utils/ThreadTopicDiagnostics.ts
 *
 * Content-free conversation-topic diagnostics for the reply-accepted log
 *
 * Exchange falls back to the conversation topic when it does not use the Thread-Index GUID, and its
 * MIME reader derives that topic from Subject and Thread-Topic (MS-OXCMAIL 2.2.3.2.6.3). A tag
 * prepended to the subject (e.g. "[EXTERNAL] Re: ...") defeats subject normalization, so Exchange
 * keeps the Thread-Topic when the subject ends with it. A normalizable subject ("Re: ...") whose
 * remainder differs from the topic may not keep it, depending on header order.
 * threadTopicMatches is true only when every header order keeps the Thread-Topic, and
 * subjectHasTag records a tag either way. Neither logs a value.
 *
 * Top-level declarations:
 * - ThreadTopicDiagnostics: Boolean-only topic diagnostics
 * - hasSubjectTag: Whether a subject carries a gateway-style tag in its leading prefixes
 * - normalizeExchangeSubject: Exchange's one-prefix subject normalization, or undefined
 * - decodeTopicHeader: Decodes RFC 2047 encoded words in a raw Thread-Topic header value
 * - normalizeTopic: Comparison form of a topic (whitespace collapsed, uppercased)
 * - keepsThreadTopic: Whether Exchange keeps the Thread-Topic for a subject in every header order
 * - describeThreadTopic: Builds the diagnostics from inbound headers and subject
 */

import { decodeWords } from "postal-mime";

/** Boolean-only topic diagnostics; never carries header or subject values. */
export interface ThreadTopicDiagnostics {
  /** The inbound email had a non-blank Thread-Topic header. */
  threadTopicPresent: boolean;
  /**
   * Exchange keeps the inbound Thread-Topic as the conversation topic whatever the MIME header
   * order: the normalized subject equals it, or a subject Exchange cannot normalize ends with it.
   * False without an inbound topic, and false when the outcome would depend on header order.
   */
  threadTopicMatches: boolean;
  /** The inbound subject has a bracketed or CAUTION:/EXTERNAL:-style tag before or after Re:/FW:. */
  subjectHasTag: boolean;
}

/** One leading reply or forward prefix: "Re:", "RE[2]:", "FW:", "Fwd:", "AW:", "WG:", "TR:", ... */
const REPLY_OR_FORWARD_PREFIX = /^\s*(?:re|aw|sv|antw|fw|fwd|wg|tr|rv|vs)\s*(?:\[\d+\])?\s*:\s*/i;
/** A short bracketed token, e.g. "[EXTERNAL]", "[外部]"; a tag needs a letter, so "[2]" is not one. */
const BRACKETED_TOKEN = /^\s*\[([^\]\r\n]{1,64})\]/;
const LETTER = /\p{L}/u;
/** A warning-word prefix such as "CAUTION:", "EXTERNAL -", "*EXTERNAL*". */
const WARNING_PREFIX =
  /^\s*\*?\s*(?:caution|external|ext|warning|suspicious|suspect|spam|phish(?:ing)?)(?:\s*:|\s*\*|\s+-\s)/i;
/** Bounds the prefix scan; real subjects carry only a few stacked prefixes. */
const MAX_PREFIX_TOKENS = 10;

/**
 * Whether the subject's leading prefix chain (reply, forward and tag tokens in any order)
 * contains a gateway-style tag.
 * @param subject - Inbound subject as parsed
 */
export function hasSubjectTag(subject: string): boolean {
  let rest = subject;
  for (let step = 0; step < MAX_PREFIX_TOKENS; step++) {
    const bracketed = BRACKETED_TOKEN.exec(rest);
    if (bracketed && LETTER.test(bracketed[1])) {
      return true;
    }
    if (WARNING_PREFIX.test(rest)) {
      return true;
    }
    const prefix = REPLY_OR_FORWARD_PREFIX.exec(rest);
    if (!prefix) {
      return false;
    }
    rest = rest.slice(prefix[0].length);
  }
  return false;
}

/** Exchange subject prefix: 1-3 characters other than colon, blank or digit, a colon, blanks. */
const EXCHANGE_SUBJECT_PREFIX = /^[^:\s0-9]{1,3}: */;

/**
 * Exchange's subject normalization (MS-OXCMAIL 2.2.3.2.6.1): strips exactly one short prefix
 * such as "RE: " or "FW: ". Returns undefined when the subject has no such prefix.
 * @param subject - Inbound subject as parsed
 */
function normalizeExchangeSubject(subject: string): string | undefined {
  const prefix = EXCHANGE_SUBJECT_PREFIX.exec(subject);
  return prefix ? subject.slice(prefix[0].length) : undefined;
}

/**
 * Decodes RFC 2047 encoded words so a raw Thread-Topic compares with the parser-decoded subject.
 * A malformed encoded word leaves the raw value, which then simply fails to match.
 * @param value - Raw Thread-Topic header value
 */
function decodeTopicHeader(value: string): string {
  try {
    return decodeWords(value);
  } catch {
    return value;
  }
}

/**
 * Topic comparison form: trimmed, whitespace collapsed, uppercased as Exchange hashes topics.
 * @param topic - Decoded topic or subject
 */
function normalizeTopic(topic: string): string {
  return topic.replace(/\s+/g, " ").trim().toUpperCase();
}

/**
 * Whether Exchange keeps the topic for this subject in every MIME header order.
 * @param subject - Inbound subject as parsed
 * @param normalizedTopic - Decoded inbound Thread-Topic in comparison form
 */
function keepsThreadTopic(subject: string, normalizedTopic: string): boolean {
  const normalizedSubject = normalizeExchangeSubject(subject);
  return normalizedSubject === undefined
    ? normalizeTopic(subject).endsWith(normalizedTopic)
    : normalizeTopic(normalizedSubject) === normalizedTopic;
}

/**
 * Builds boolean-only topic diagnostics. The header map does not keep MIME header order, so the
 * match follows MS-OXCMAIL 2.2.3.2.6.3 conservatively. A normalizable subject matches only when its
 * normalized remainder equals the topic, the outcome Exchange reaches in both orders. A subject
 * Exchange cannot normalize matches when it ends with the topic.
 * @param headers - Inbound header map with lowercase names
 * @param subject - Inbound subject as parsed
 */
export function describeThreadTopic(
  headers: Record<string, string> | undefined,
  subject: string
): ThreadTopicDiagnostics {
  const rawTopic = headers?.["thread-topic"] ?? "";
  const threadTopicPresent = rawTopic.trim().length > 0;
  const inboundTopic = normalizeTopic(decodeTopicHeader(rawTopic));
  return {
    threadTopicPresent,
    threadTopicMatches:
      threadTopicPresent && inboundTopic.length > 0 && keepsThreadTopic(subject, inboundTopic),
    subjectHasTag: hasSubjectTag(subject),
  };
}
