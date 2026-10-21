/**
 * src/email/utils/OutlookThreading.ts
 *
 * Outlook/Exchange conversation headers (Thread-Index, Thread-Topic) for replies
 *
 * Exchange groups a conversation by the GUID inside Thread-Index (PidTagConversationIndex,
 * MS-OXOMSG 2.2.1.3), not by In-Reply-To/References, so a reply without a child Thread-Index
 * lands in a new conversation. A child index is the parent's bytes plus one 5-byte response
 * level; Thread-Topic carries the conversation topic (subject without reply prefixes).
 *
 * Top-level declarations:
 * - OutlookThreadHeaders: Thread-Index/Thread-Topic headers for an outbound reply
 * - buildChildThreadIndex: Appends one MS-OXOMSG response level to a base64 parent Thread-Index
 * - buildOutlookThreadHeaders: Thread-Index/Thread-Topic for a reply, or none when the parent has no valid index
 */

import { stripReplyPrefixes } from "./ReplySubject";

const HEADER_BYTES = 22;
const RESPONSE_LEVEL_BYTES = 5;
/** Keeps the unfoldable base64 value under the RFC 5322 998-character line limit. */
const MAX_THREAD_INDEX_BYTES = HEADER_BYTES + RESPONSE_LEVEL_BYTES * 140;
const MAX_THREAD_TOPIC_LENGTH = 255;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
const PRINTABLE_ASCII_PATTERN = /^[\x20-\x7e]+$/;
/** 100 ns intervals between 1601-01-01 (FILETIME epoch) and 1970-01-01. */
const FILETIME_UNIX_EPOCH_OFFSET = 116444736000000000n;
/** One day in FILETIME units: tolerated sender clock skew before a header time is implausible. */
const CLOCK_SKEW_TOLERANCE = 864000000000n;
const LEGACY_HIGH_BYTE_SHIFT = 56n;
const LONG_DELTA_MASK = 0x00fe000000000000n;
const TIME_DELTA_MASK = 0x7fffffffn;

/** Thread-Index/Thread-Topic headers for an outbound reply; both absent when not applicable. */
export interface OutlookThreadHeaders {
  "Thread-Index"?: string;
  "Thread-Topic"?: string;
}

/**
 * Decodes a strict base64 Thread-Index that has a valid header and whole response levels.
 * Whitespace left by header folding is ignored, as RFC 2045 base64 decoders must.
 */
function decodeThreadIndex(value: string | undefined): Uint8Array | undefined {
  const trimmed = value?.replace(/[ \t\r\n]+/g, "") ?? "";
  if (trimmed.length === 0 || trimmed.length % 4 !== 0 || !BASE64_PATTERN.test(trimmed)) {
    return undefined;
  }
  let binary: string;
  try {
    binary = atob(trimmed);
  } catch {
    return undefined;
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const wholeIndex =
    bytes.length >= HEADER_BYTES &&
    (bytes.length - HEADER_BYTES) % RESPONSE_LEVEL_BYTES === 0 &&
    bytes[0] === 0x01;
  return wholeIndex ? bytes : undefined;
}

/**
 * Reconstructs the header FILETIME. The current layout (MS-OXOMSG 2.2.1.3) stores the high 40
 * bits; Exchange 2007/2010 and Outlook 2007-2019 store bits 16-55 instead (MS-OXOMSG Appendix A
 * note 2), which reads as a far-future time in the current layout. Such a value is rebuilt with
 * the legacy layout, taking the omitted high byte from the current time.
 */
function decodeHeaderFiletime(parent: Uint8Array, now: bigint): bigint {
  let fields = 0n;
  for (let index = 1; index <= 5; index++) {
    fields = (fields << 8n) | BigInt(parent[index]);
  }
  const current = fields << 24n;
  if (current <= now + CLOCK_SKEW_TOLERANCE) {
    return current;
  }
  const highByte = (now >> LEGACY_HIGH_BYTE_SHIFT) << LEGACY_HIGH_BYTE_SHIFT;
  const legacy = highByte | (fields << 16n);
  return legacy > now + CLOCK_SKEW_TOLERANCE ? legacy - (1n << LEGACY_HIGH_BYTE_SHIFT) : legacy;
}

/**
 * Appends one MS-OXOMSG response level to a base64 parent Thread-Index: the time since the
 * header's FILETIME (DC bit + 31-bit delta) plus one random byte. Returns undefined when the
 * parent is not a valid conversation index or the child would exceed the length cap.
 * @param parentThreadIndex - Inbound Thread-Index header value
 * @param nowMs - Current time in Unix milliseconds
 * @param randomByte - Random byte for the response level
 */
export function buildChildThreadIndex(
  parentThreadIndex: string | undefined,
  nowMs: number,
  randomByte: number
): string | undefined {
  const parent = decodeThreadIndex(parentThreadIndex);
  if (!parent || parent.length + RESPONSE_LEVEL_BYTES > MAX_THREAD_INDEX_BYTES) {
    return undefined;
  }

  const now = BigInt(Math.trunc(nowMs)) * 10000n + FILETIME_UNIX_EPOCH_OFFSET;
  const headerTime = decodeHeaderFiletime(parent, now);
  const timeDiff = now > headerTime ? now - headerTime : 0n;
  const longDelta = (timeDiff & LONG_DELTA_MASK) !== 0n;
  const timeDelta = (timeDiff >> (longDelta ? 23n : 18n)) & TIME_DELTA_MASK;
  const level = Number((longDelta ? 1n << 31n : 0n) | timeDelta);

  const child = new Uint8Array(parent.length + RESPONSE_LEVEL_BYTES);
  child.set(parent);
  const offset = parent.length;
  child[offset] = (level >>> 24) & 0xff;
  child[offset + 1] = (level >>> 16) & 0xff;
  child[offset + 2] = (level >>> 8) & 0xff;
  child[offset + 3] = level & 0xff;
  child[offset + 4] = randomByte & 0xff;
  return btoa(String.fromCharCode(...child));
}

/** Conversation topic: the inbound Thread-Topic, else the subject without reply prefixes. */
function resolveThreadTopic(inboundTopic: string | undefined, subject: string): string | undefined {
  for (const candidate of [inboundTopic?.trim(), stripReplyPrefixes(subject)]) {
    if (
      candidate &&
      candidate.length <= MAX_THREAD_TOPIC_LENGTH &&
      PRINTABLE_ASCII_PATTERN.test(candidate)
    ) {
      return candidate;
    }
  }
  return undefined;
}

/**
 * Builds Thread-Index (child of the inbound index) and Thread-Topic for a reply. Returns no
 * headers when the inbound email has no valid Thread-Index: a fresh index would start a new
 * Exchange conversation anyway. Thread-Topic is omitted when the topic is not printable ASCII.
 * @param headers - Inbound header map with lowercase names
 * @param subject - Inbound subject as parsed
 * @param nowMs - Current time in Unix milliseconds
 */
export function buildOutlookThreadHeaders(
  headers: Record<string, string> | undefined,
  subject: string,
  nowMs: number
): OutlookThreadHeaders {
  const randomByte = crypto.getRandomValues(new Uint8Array(1))[0];
  const threadIndex = buildChildThreadIndex(headers?.["thread-index"], nowMs, randomByte);
  if (!threadIndex) {
    return {};
  }
  const outlookHeaders: OutlookThreadHeaders = { "Thread-Index": threadIndex };
  const threadTopic = resolveThreadTopic(headers?.["thread-topic"], subject);
  if (threadTopic) {
    outlookHeaders["Thread-Topic"] = threadTopic;
  }
  return outlookHeaders;
}
