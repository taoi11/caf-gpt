/**
 * src/agents/utils/ThreadHistory.ts
 *
 * Per-user thread history kept in the UserAgent Durable Object's SQLite so Prime Foo keeps
 * prior-turn context after replies stopped quoting history into the email body
 *
 * Top-level declarations:
 * - THREAD_HISTORY_MAX_CHARS: Cap on prior-turn text appended to the model context
 * - THREAD_HISTORY_MAX_TURNS: Cap on stored prior turns loaded per thread
 * - THREAD_HISTORY_MAX_LINKED_IDS: Cap on linking Message-IDs looked up or mapped per email
 * - THREAD_HISTORY_RETENTION_MS: Age after which stored turns and message mappings are pruned
 * - THREAD_HISTORY_PRUNE_INTERVAL_SECONDS: Interval of the scheduled prune while history exists
 * - ThreadSql: Injectable tagged-template SQL surface (Agent.sql)
 * - ThreadLookup: Matched thread id plus the history text to append
 * - getThreadMessageIds: Valid Message-IDs that link an inbound email to an earlier turn
 * - loadThreadHistory: Finds the stored thread for an inbound email and returns its history
 * - recordThreadTurn: Stores the replied-to inbound email as the newest turn of its thread
 * - pruneThreadHistory: Deletes expired turns and mappings; returns the turns left
 */

import { isValidMessageId, parseMessageIdList } from "../../email/utils/EmailValidator";
import type { ParsedEmailData } from "../../email/types";

/** Cap on prior-turn text appended to the model context (newest turns kept). */
export const THREAD_HISTORY_MAX_CHARS = 20_000;

/** Cap on stored prior turns loaded per thread. */
export const THREAD_HISTORY_MAX_TURNS = 20;

/** Cap on linking Message-IDs looked up or mapped per inbound email (newest kept). */
export const THREAD_HISTORY_MAX_LINKED_IDS = 20;

/** Stored turns and message mappings older than this are pruned on read, write, and schedule. */
export const THREAD_HISTORY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** The scheduled prune runs daily while any turn is stored. */
export const THREAD_HISTORY_PRUNE_INTERVAL_SECONDS = 24 * 60 * 60;

/** Injectable tagged-template SQL surface matching Agent.sql. */
export type ThreadSql = <Row = Record<string, string | number | boolean | null>>(
  strings: TemplateStringsArray,
  ...values: (string | number | boolean | null)[]
) => Row[];

/** Result of looking up the stored thread for an inbound email. */
export interface ThreadLookup {
  threadId?: string;
  history: string;
}

interface ThreadIdRow {
  thread_id: string;
}

interface TurnRow {
  block: string;
}

/** Normalizes an Email Service message id to an angle-bracketed Message-ID, if valid. */
function toMessageId(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const messageId = value.startsWith("<") ? value : `<${value}>`;

  return isValidMessageId(messageId) ? messageId : undefined;
}

/** Creates the thread tables if they do not exist yet (idempotent). */
function ensureThreadTables(sql: ThreadSql): void {
  void sql`CREATE TABLE IF NOT EXISTS cafgpt_thread_messages (
    message_id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`;
  void sql`CREATE TABLE IF NOT EXISTS cafgpt_thread_turns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    block TEXT NOT NULL
  )`;
}

/**
 * Valid Message-IDs that link an inbound email to earlier turns: In-Reply-To, then References
 * (newest first), capped at THREAD_HISTORY_MAX_LINKED_IDS. The inbound email's own Message-ID
 * is excluded.
 * @param parsedEmail - Parsed inbound email
 */
export function getThreadMessageIds(parsedEmail: ParsedEmailData): string[] {
  const references = parseMessageIdList(parsedEmail.references).reverse();
  const inReplyTo = parseMessageIdList(parsedEmail.inReplyTo);

  return [...new Set([...inReplyTo, ...references])]
    .filter((id) => id !== parsedEmail.messageId)
    .slice(0, THREAD_HISTORY_MAX_LINKED_IDS);
}

/**
 * Finds the stored thread an inbound email continues and returns its prior turns (newest first,
 * the order nested quoting used), capped at THREAD_HISTORY_MAX_CHARS. Expired rows are pruned
 * first so they never reach the model.
 * @param sql - Agent SQL surface
 * @param parsedEmail - Parsed inbound email
 * @param now - Current epoch milliseconds
 */
export function loadThreadHistory(
  sql: ThreadSql,
  parsedEmail: ParsedEmailData,
  now: number
): ThreadLookup {
  pruneThreadHistory(sql, now);
  let threadId: string | undefined;

  for (const messageId of getThreadMessageIds(parsedEmail)) {
    const rows = sql<ThreadIdRow>`SELECT thread_id FROM cafgpt_thread_messages WHERE message_id = ${messageId}`;

    if (rows.length > 0) {
      threadId = rows[0].thread_id;
      break;
    }
  }

  if (!threadId) return { history: "" };

  const turns = sql<TurnRow>`SELECT block FROM cafgpt_thread_turns WHERE thread_id = ${threadId}
    ORDER BY created_at DESC, id DESC LIMIT ${THREAD_HISTORY_MAX_TURNS}`;

  let history = "";

  for (const turn of turns) {
    history += turn.block.slice(0, THREAD_HISTORY_MAX_CHARS - history.length);

    if (history.length >= THREAD_HISTORY_MAX_CHARS) break;
  }

  return { threadId, history };
}

/**
 * Stores the answered turn's history block (our reply, then the inbound email) as the newest turn of its thread and maps
 * its Message-ID (and the ids it referenced) to the thread so the user's next reply finds it.
 * Each block is capped at THREAD_HISTORY_MAX_CHARS and each thread at THREAD_HISTORY_MAX_TURNS;
 * turns and mappings older than THREAD_HISTORY_RETENTION_MS are pruned.
 * @param sql - Agent SQL surface
 * @param parsedEmail - Parsed inbound email that was answered
 * @param block - Plain-text history block for this turn (our reply, then the inbound email)
 * @param existingThreadId - Thread id returned by loadThreadHistory, when one matched
 * @param outboundMessageId - Message-ID Email Service assigned our reply, so a reply that carries
 *   only In-Reply-To (no References) still matches
 * @param now - Current epoch milliseconds
 */
export function recordThreadTurn(
  sql: ThreadSql,
  parsedEmail: ParsedEmailData,
  block: string,
  existingThreadId: string | undefined,
  outboundMessageId: string | undefined,
  now: number
): void {
  ensureThreadTables(sql);

  const ownId =
    parsedEmail.messageId && isValidMessageId(parsedEmail.messageId)
      ? parsedEmail.messageId
      : undefined;

  const linkedIds = getThreadMessageIds(parsedEmail);
  const replyId = toMessageId(outboundMessageId);
  const threadId = existingThreadId ?? ownId ?? linkedIds[0] ?? replyId;

  if (!threadId) return;

  const storedBlock = block.slice(0, THREAD_HISTORY_MAX_CHARS);
  void sql`INSERT INTO cafgpt_thread_turns (thread_id, created_at, block) VALUES (${threadId}, ${now}, ${storedBlock})`;
  const mappedIds = [...(ownId ? [ownId] : []), ...(replyId ? [replyId] : []), ...linkedIds];

  for (const messageId of mappedIds) {
    void sql`INSERT OR REPLACE INTO cafgpt_thread_messages (message_id, thread_id, created_at)
      VALUES (${messageId}, ${threadId}, ${now})`;
  }

  void sql`DELETE FROM cafgpt_thread_turns WHERE thread_id = ${threadId} AND id NOT IN (
    SELECT id FROM cafgpt_thread_turns WHERE thread_id = ${threadId}
    ORDER BY created_at DESC, id DESC LIMIT ${THREAD_HISTORY_MAX_TURNS})`;
  pruneThreadHistory(sql, now);
}

/**
 * Deletes turns and message mappings older than THREAD_HISTORY_RETENTION_MS.
 * @param sql - Agent SQL surface
 * @param now - Current epoch milliseconds
 * @returns Number of turns still stored
 */
export function pruneThreadHistory(sql: ThreadSql, now: number): number {
  ensureThreadTables(sql);
  const cutoff = now - THREAD_HISTORY_RETENTION_MS;
  void sql`DELETE FROM cafgpt_thread_turns WHERE created_at < ${cutoff}`;
  void sql`DELETE FROM cafgpt_thread_messages WHERE created_at < ${cutoff}`;

  return sql<{ count: number }>`SELECT COUNT(*) AS count FROM cafgpt_thread_turns`[0]?.count ?? 0;
}
