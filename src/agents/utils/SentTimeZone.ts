/**
 * src/agents/utils/SentTimeZone.ts
 *
 * Learns the user's UTC offset for the quoted Sent: line. Each CAF-GPT reply's real UTC send time
 * is stored in the UserAgent DO's SQLite, keyed by the Message-ID Resend assigned it. The reply
 * API returns only a Resend id, so the Message-ID is read back with GET /emails/{id}; when Resend
 * has not assigned one yet the send time is kept as pending under the Resend id and resolved on
 * the user's next inbound email, before matching.
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
 * - PendingSentTime: A reply send time whose Message-ID Resend had not assigned yet
 * - recordPendingSentTime: Stores a send time under the reply's Resend id until its Message-ID is known
 * - listPendingSentTimes: Oldest-first pending send times, capped
 * - resolvePendingSentTime: Moves a pending send time under its now-known Message-ID
 * - saveSentOffset: Saves the user's last good offset
 * - loadSavedSentOffset: Reads the user's last saved offset, if still retained
 * - resolveSentZone: Decides the Sent: zone for the reply to one inbound email
 * - pruneSentTimes: Deletes expired send times (pending too) and offsets; returns the rows left
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

/** A reply send time whose Message-ID Resend had not assigned yet. */
export interface PendingSentTime {
  resendEmailId: string;
  sentAt: number;
  /** Thread the reply's turn was stored under, so its Message-ID can be linked once known. */
  threadId?: string;
}

interface PendingRow {
  resend_email_id: string;
  sent_at: number;
  thread_id: string | null;
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
  void sql`CREATE TABLE IF NOT EXISTS cafgpt_pending_sent_times (
    resend_email_id TEXT PRIMARY KEY,
    sent_at INTEGER NOT NULL,
    thread_id TEXT,
    created_at INTEGER NOT NULL
  )`;
  void sql`CREATE TABLE IF NOT EXISTS cafgpt_sent_offset (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    offset_minutes INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`;
}

/** Normalizes a sent message id to an angle-bracketed Message-ID, if valid. */
function toMessageId(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const messageId = value.startsWith("<") ? value : `<${value}>`;

  return isValidMessageId(messageId) ? messageId : undefined;
}

/**
 * Stores one reply's real UTC send time under the Message-ID Resend assigned it.
 * @param sql - Agent SQL surface
 * @param outboundMessageId - Message-ID read back from Resend for the sent reply
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
 * Stores a reply's send time under its Resend id until Resend reports its Message-ID.
 * @param sql - Agent SQL surface
 * @param resendEmailId - Resend id returned by the reply endpoint
 * @param sentAtMs - Epoch milliseconds captured immediately before sending
 * @param threadId - Thread the reply's turn was stored under, if any
 * @param now - Current epoch milliseconds
 */
export function recordPendingSentTime(
  sql: ThreadSql,
  resendEmailId: string,
  sentAtMs: number,
  threadId: string | undefined,
  now: number
): void {
  ensureSentTables(sql);
  void sql`INSERT OR REPLACE INTO cafgpt_pending_sent_times (resend_email_id, sent_at, thread_id, created_at)
    VALUES (${resendEmailId}, ${sentAtMs}, ${threadId ?? null}, ${now})`;
  pruneSentTimes(sql, now);
}

/**
 * Oldest-first pending send times (expired rows pruned first), capped at `limit`.
 * @param sql - Agent SQL surface
 * @param now - Current epoch milliseconds
 * @param limit - Most rows to return
 */
export function listPendingSentTimes(
  sql: ThreadSql,
  now: number,
  limit: number
): PendingSentTime[] {
  pruneSentTimes(sql, now);

  return sql<PendingRow>`SELECT resend_email_id, sent_at, thread_id FROM cafgpt_pending_sent_times
    ORDER BY created_at ASC LIMIT ${limit}`.map((row) => {
    const pending: PendingSentTime = { resendEmailId: row.resend_email_id, sentAt: row.sent_at };

    if (row.thread_id) pending.threadId = row.thread_id;

    return pending;
  });
}

/**
 * Moves a pending send time under its now-known Message-ID.
 * @param sql - Agent SQL surface
 * @param pending - Pending row from listPendingSentTimes
 * @param outboundMessageId - Message-ID Resend now reports for the reply
 * @param now - Current epoch milliseconds
 * @returns True when the Message-ID was valid and the send time was stored under it
 */
export function resolvePendingSentTime(
  sql: ThreadSql,
  pending: PendingSentTime,
  outboundMessageId: string,
  now: number
): boolean {
  const stored = recordReplySentTime(sql, outboundMessageId, pending.sentAt, now);

  if (stored) {
    void sql`DELETE FROM cafgpt_pending_sent_times WHERE resend_email_id = ${pending.resendEmailId}`;
  }

  return stored;
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
  void sql`DELETE FROM cafgpt_pending_sent_times WHERE created_at < ${cutoff}`;
  void sql`DELETE FROM cafgpt_sent_offset WHERE updated_at < ${cutoff}`;

  const times =
    sql<{ count: number }>`SELECT COUNT(*) AS count FROM cafgpt_reply_sent_times`[0]?.count ?? 0;

  const pending =
    sql<{ count: number }>`SELECT COUNT(*) AS count FROM cafgpt_pending_sent_times`[0]?.count ?? 0;

  const offsets =
    sql<{ count: number }>`SELECT COUNT(*) AS count FROM cafgpt_sent_offset`[0]?.count ?? 0;

  return times + pending + offsets;
}
