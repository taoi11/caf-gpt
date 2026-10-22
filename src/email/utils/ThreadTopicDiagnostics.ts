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
 * - describeThreadTopic: Builds the diagnostics from inbound headers and subject
 */

import { stripReplyPrefixes } from "./ReplySubject";

/** Boolean-only topic diagnostics; never carries header or subject values. */
export interface ThreadTopicDiagnostics {
  /** The inbound email had a non-blank Thread-Topic header. */
  threadTopicPresent: boolean;
  /** Subject-derived topic equals the inbound Thread-Topic after normalization; false without one. */
  threadTopicMatches: boolean;
  /** The inbound subject has a bracketed or CAUTION:/EXTERNAL:-style tag before or after Re:/FW:. */
  subjectHasTag: boolean;
}

/** One leading reply or forward prefix: "Re:", "RE[2]:", "FW:", "Fwd:", "AW:", "WG:", "TR:", ... */
const REPLY_OR_FORWARD_PREFIX = /^\s*(?:re|aw|sv|antw|fw|fwd|wg|tr|rv|vs)\s*(?:\[\d+\])?\s*:\s*/i;
/** A short bracketed token, e.g. "[EXTERNAL]"; a tag needs a letter, so "[2]" is not one. */
const BRACKETED_TOKEN = /^\s*\[([^\]\r\n]{1,64})\]/;
const LETTER = /[A-Za-z]/;
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

/** Topic comparison form: trimmed, whitespace collapsed, uppercased as Exchange hashes topics. */
function normalizeTopic(topic: string): string {
  return topic.replace(/\s+/g, " ").trim().toUpperCase();
}

/**
 * Builds boolean-only topic diagnostics. The derived topic is the subject without reply
 * prefixes (the Thread-Topic fallback in OutlookThreading), compared to the inbound Thread-Topic.
 * @param headers - Inbound header map with lowercase names
 * @param subject - Inbound subject as parsed
 */
export function describeThreadTopic(
  headers: Record<string, string> | undefined,
  subject: string
): ThreadTopicDiagnostics {
  const inboundTopic = normalizeTopic(headers?.["thread-topic"] ?? "");
  const threadTopicPresent = inboundTopic.length > 0;
  return {
    threadTopicPresent,
    threadTopicMatches:
      threadTopicPresent && normalizeTopic(stripReplyPrefixes(subject)) === inboundTopic,
    subjectHasTag: hasSubjectTag(subject),
  };
}
