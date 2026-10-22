/**
 * src/email/utils/ThreadTopicDiagnostics.ts
 *
 * Content-free conversation-topic diagnostics for the reply-accepted log
 *
 * Exchange falls back to the conversation topic when it does not use the Thread-Index GUID, so a
 * subject that differs from the sender's Thread-Topic (e.g. a gateway "[EXTERNAL]" tag) starts a
 * new conversation. These booleans show whether that happens without logging any value.
 *
 * Top-level declarations:
 * - ThreadTopicDiagnostics: Boolean-only topic diagnostics
 * - hasSubjectTag: Whether a subject carries a gateway-style tag in its leading prefixes
 * - decodeTopicHeader: Decodes RFC 2047 encoded words in a raw Thread-Topic header value
 * - normalizeTopic: Comparison form of a topic (whitespace collapsed, uppercased)
 * - describeThreadTopic: Builds the diagnostics from inbound headers and subject
 */

import { decodeWords } from "postal-mime";
import { stripReplyPrefixes } from "./ReplySubject";

/** Boolean-only topic diagnostics; never carries header or subject values. */
export interface ThreadTopicDiagnostics {
  /** The inbound email had a non-blank Thread-Topic header. */
  threadTopicPresent: boolean;
  /**
   * The subject still carries the inbound Thread-Topic as Exchange's MIME reader checks it: equal
   * after reply-prefix stripping, or the subject ends with it. False without an inbound topic.
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
 * Builds boolean-only topic diagnostics. The topic matches when the subject without reply
 * prefixes (the Thread-Topic fallback in OutlookThreading) equals the inbound Thread-Topic, or
 * when the subject ends with it: Exchange's MIME reader then keeps the Thread-Topic as the
 * conversation topic (MS-OXCMAIL 2.2.3.2.6.3), so a prepended gateway tag alone does not change it.
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
      threadTopicPresent &&
      inboundTopic.length > 0 &&
      (normalizeTopic(stripReplyPrefixes(subject)) === inboundTopic ||
        normalizeTopic(subject).endsWith(inboundTopic)),
    subjectHasTag: hasSubjectTag(subject),
  };
}
