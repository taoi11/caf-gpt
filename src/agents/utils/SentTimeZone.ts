/**
 * src/agents/utils/SentTimeZone.ts
 *
 * Learns the user's UTC offset for the quoted Sent: line. Each CAF-GPT reply's real UTC send time
 * is stored in the UserAgent DO's SQLite, keyed by the Message-ID Email Service returned for it.
 * When the user replies, their Outlook quotes that reply with a zone-less Sent: line in their
 * local PC time; matching it (via In-Reply-To, then References) to the stored send time gives the
 * offset, rounded to 15 minutes, which is saved per user. Without a quoted CAF-GPT block the
 * saved offset is used, else America/Edmonton. Only Message-IDs, send times, and the offset are
 * stored (never quoted text), with ThreadHistory's 30-day retention.
 *
 * Top-level declarations:
 * - SentZoneReason: Fixed, content-free reasons a quoted CAF-GPT Sent: line taught nothing
 * - SentZoneSource: Where the Sent: zone came from (learned, saved, default)
 * - SentZoneDecision: Zone for the new quote plus content-free diagnostics
 * - recordReplySentTime: Stores one reply's real UTC send time under its Message-ID
 * - saveSentOffset: Saves the user's last good offset
 * - loadSavedSentOffset: Reads the user's last saved offset, if still retained
 * - resolveSentZone: Decides the Sent: zone for the reply to one inbound email
 * - pruneSentTimes: Deletes expired send times and offsets; returns the rows left
 */

import { OUTLOOK_SENT_TIME_ZONE, type SentZone } from "../../email/components/QuotedHistory";
import type { ParsedEmailData } from "../../email/types";
import { isValidMessageId, parseMessageIdList } from "../../email/utils/EmailValidator";
import { htmlToText } from "../../email/utils/HtmlToText";
import {
  findTopQuotedHeader,
  isSelfQuotedSender,
  learnSentOffset,
  parseOutlookSentLine,
} from "../../email/utils/QuotedSentLine";
import { getThreadMessageIds, THREAD_HISTORY_RETENTION_MS, type ThreadSql } from "./ThreadHistory";

/** Fixed, content-free reasons a quoted CAF-GPT Sent: line taught nothing. */
export type SentZoneReason =
  | "quoted_sent_unparseable"
  | "quoted_sent_no_record"
  | "quoted_sent_unmatched"
  | "quoted_sent_ambiguous"
  | "quoted_sent_storage_failed";

/** Where the Sent: zone came from. */
export type SentZoneSource = "learned" | "saved" | "default";

/** Zone for the new quote plus content-free diagnostics. */
export interface SentZoneDecision {
  zone: SentZone;
  source: SentZoneSource;
  /** Offset used, when learned or saved (the default zone has none). */
  offsetMinutes?: number;
  /** True when the topmost quoted header block is CAF-GPT's own earlier reply. */
  lineFound: boolean;
  reason?: SentZoneReason;
}

interface SentAtRow {
  sent_at: number;
}

interface OffsetRow {
  offset_minutes: number;
}

/** Creates the send-time and offset tables if they do not exist yet (idempotent). */
function ensureSentTables(sql: ThreadSql): void {
  void sql`CREATE TABLE IF NOT EXISTS cafgpt_reply_sent_times (
    message_id TEXT PRIMARY KEY,
    sent_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )`;
  void sql`CREATE TABLE IF NOT EXISTS cafgpt_sent_offset (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    offset_minutes INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`;
}

/** Normalizes an Email Service message id to an angle-bracketed Message-ID, if valid. */
function toMessageId(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const messageId = value.startsWith("<") ? value : `<${value}>`;
  return isValidMessageId(messageId) ? messageId : undefined;
}

/**
 * Stores one reply's real UTC send time under the Message-ID Email Service assigned it.
 * @param sql - Agent SQL surface
 * @param outboundMessageId - Message-ID returned by sendEmail
 * @param sentAtMs - Epoch milliseconds captured immediately before sending
 * @param now - Current epoch milliseconds
 * @returns True when a valid Message-ID was available and the row was stored
 */
export function recordReplySentTime(
  sql: ThreadSql,
  outboundMessageId: string | undefined,
  sentAtMs: number,
  now: number
): boolean {
  ensureSentTables(sql);
  const messageId = toMessageId(outboundMessageId);
  if (!messageId) return false;
  void sql`INSERT OR REPLACE INTO cafgpt_reply_sent_times (message_id, sent_at, created_at)
    VALUES (${messageId}, ${sentAtMs}, ${now})`;
  pruneSentTimes(sql, now);
  return true;
}

/**
 * Saves the user's last good offset (one row; each DO is one user).
 * @param sql - Agent SQL surface
 * @param offsetMinutes - Learned offset in minutes east of UTC
 * @param now - Current epoch milliseconds
 */
export function saveSentOffset(sql: ThreadSql, offsetMinutes: number, now: number): void {
  ensureSentTables(sql);
  void sql`INSERT OR REPLACE INTO cafgpt_sent_offset (id, offset_minutes, updated_at)
    VALUES (1, ${offsetMinutes}, ${now})`;
}

/**
 * Reads the user's last saved offset, pruning expired rows first.
 * @param sql - Agent SQL surface
 * @param now - Current epoch milliseconds
 */
export function loadSavedSentOffset(sql: ThreadSql, now: number): number | undefined {
  pruneSentTimes(sql, now);
  return sql<OffsetRow>`SELECT offset_minutes FROM cafgpt_sent_offset WHERE id = 1`[0]
    ?.offset_minutes;
}

/** Saved offset, else the America/Edmonton default. */
function fallbackZone(
  sql: ThreadSql,
  now: number,
  lineFound: boolean,
  reason?: SentZoneReason
): SentZoneDecision {
  const saved = loadSavedSentOffset(sql, now);
  const decision: SentZoneDecision =
    saved === undefined
      ? { zone: { timeZone: OUTLOOK_SENT_TIME_ZONE }, source: "default", lineFound }
      : { zone: { offsetMinutes: saved }, source: "saved", offsetMinutes: saved, lineFound };
  if (reason) decision.reason = reason;
  return decision;
}

/** Stored send time for one Message-ID, if retained. */
function loadSentAt(sql: ThreadSql, messageId: string): number | undefined {
  return sql<SentAtRow>`SELECT sent_at FROM cafgpt_reply_sent_times WHERE message_id = ${messageId}`[0]
    ?.sent_at;
}

/**
 * Decides the Sent: zone for the reply to one inbound email. When the topmost quoted header
 * block is CAF-GPT's own reply, its Sent: line is parsed and matched against the stored send
 * time of the In-Reply-To message (or, failing that, the only consistent References match);
 * otherwise, or when learning fails (with a fixed reason), the saved offset or the default is used.
 * @param sql - Agent SQL surface
 * @param parsedEmail - Parsed inbound email
 * @param selfAddresses - CAF-GPT's own normalized addresses
 * @param now - Current epoch milliseconds
 */
export function resolveSentZone(
  sql: ThreadSql,
  parsedEmail: ParsedEmailData,
  selfAddresses: readonly string[],
  now: number
): SentZoneDecision {
  const header =
    findTopQuotedHeader(parsedEmail.body) ??
    (parsedEmail.html ? findTopQuotedHeader(htmlToText(parsedEmail.html)) : undefined);
  if (!header || !isSelfQuotedSender(header.from, selfAddresses)) {
    return fallbackZone(sql, now, false);
  }

  const quotedWallMs = parseOutlookSentLine(header.sent);
  if (quotedWallMs === undefined) return fallbackZone(sql, now, true, "quoted_sent_unparseable");

  pruneSentTimes(sql, now);
  const inReplyTo = parseMessageIdList(parsedEmail.inReplyTo).filter(
    (id) => id !== parsedEmail.messageId
  );
  for (const messageId of inReplyTo) {
    const sentAt = loadSentAt(sql, messageId);
    if (sentAt === undefined) continue;
    const offset = learnSentOffset(quotedWallMs, sentAt);
    return offset === undefined
      ? fallbackZone(sql, now, true, "quoted_sent_unmatched")
      : {
          zone: { offsetMinutes: offset },
          source: "learned",
          offsetMinutes: offset,
          lineFound: true,
        };
  }

  const sentTimes = getThreadMessageIds(parsedEmail)
    .filter((id) => !inReplyTo.includes(id))
    .map((id) => loadSentAt(sql, id))
    .filter((sentAt): sentAt is number => sentAt !== undefined);
  if (sentTimes.length === 0) return fallbackZone(sql, now, true, "quoted_sent_no_record");
  const offsets = new Set(
    sentTimes
      .map((sentAt) => learnSentOffset(quotedWallMs, sentAt))
      .filter((offset): offset is number => offset !== undefined)
  );
  if (offsets.size === 0) return fallbackZone(sql, now, true, "quoted_sent_unmatched");
  if (offsets.size > 1) return fallbackZone(sql, now, true, "quoted_sent_ambiguous");
  const [offset] = offsets;
  return {
    zone: { offsetMinutes: offset },
    source: "learned",
    offsetMinutes: offset,
    lineFound: true,
  };
}

/**
 * Deletes send times and the saved offset older than THREAD_HISTORY_RETENTION_MS.
 * @param sql - Agent SQL surface
 * @param now - Current epoch milliseconds
 * @returns Number of send-time and offset rows still stored
 */
export function pruneSentTimes(sql: ThreadSql, now: number): number {
  ensureSentTables(sql);
  const cutoff = now - THREAD_HISTORY_RETENTION_MS;
  void sql`DELETE FROM cafgpt_reply_sent_times WHERE created_at < ${cutoff}`;
  void sql`DELETE FROM cafgpt_sent_offset WHERE updated_at < ${cutoff}`;
  const times =
    sql<{ count: number }>`SELECT COUNT(*) AS count FROM cafgpt_reply_sent_times`[0]?.count ?? 0;
  const offsets =
    sql<{ count: number }>`SELECT COUNT(*) AS count FROM cafgpt_sent_offset`[0]?.count ?? 0;
  return times + offsets;
}
