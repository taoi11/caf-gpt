/**
 * src/agents/utils/ThreadHistory.ts
 *
 * Per-user thread history kept in the UserAgent Durable Object's SQLite so Prime Foo keeps
 * prior-turn context after replies stopped quoting history into the email body
 *
 * Top-level declarations:
 * - THREAD_HISTORY_MAX_CHARS: Cap on prior-turn text appended to the model context
 * - THREAD_HISTORY_MAX_TURNS: Cap on stored prior turns loaded per thread
 * - THREAD_HISTORY_RETENTION_MS: Age after which stored turns and message mappings are pruned
 * - ThreadSql: Injectable tagged-template SQL surface (Agent.sql)
 * - ThreadLookup: Matched thread id plus the history text to append
 * - getThreadMessageIds: Valid Message-IDs that link an inbound email to an earlier turn
 * - loadThreadHistory: Finds the stored thread for an inbound email and returns its history
 * - recordThreadTurn: Stores the replied-to inbound email as the newest turn of its thread
 */

import { isValidMessageId } from "../../email/utils/EmailValidator";
import type { ParsedEmailData } from "../../email/types";

/** Cap on prior-turn text appended to the model context (newest turns kept). */
export const THREAD_HISTORY_MAX_CHARS = 20_000;

/** Cap on stored prior turns loaded per thread. */
export const THREAD_HISTORY_MAX_TURNS = 20;

/** Stored turns and message mappings older than this are pruned on each write. */
export const THREAD_HISTORY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

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
 * Valid Message-IDs that link an inbound email to earlier turns: References (newest first),
 * then In-Reply-To. The inbound email's own Message-ID is excluded.
 * @param parsedEmail - Parsed inbound email
 */
export function getThreadMessageIds(parsedEmail: ParsedEmailData): string[] {
  const references = (parsedEmail.references ?? "")
    .split(/\s+/)
    .filter((reference) => reference.length > 0 && isValidMessageId(reference))
    .reverse();
  const inReplyTo =
    parsedEmail.inReplyTo && isValidMessageId(parsedEmail.inReplyTo) ? [parsedEmail.inReplyTo] : [];
  return [...new Set([...references, ...inReplyTo])].filter((id) => id !== parsedEmail.messageId);
}

/**
 * Finds the stored thread an inbound email continues and returns its prior turns (newest first,
 * the order nested quoting used), capped at THREAD_HISTORY_MAX_CHARS.
 * @param sql - Agent SQL surface
 * @param parsedEmail - Parsed inbound email
 */
export function loadThreadHistory(sql: ThreadSql, parsedEmail: ParsedEmailData): ThreadLookup {
  ensureThreadTables(sql);
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
    if (history.length + turn.block.length > THREAD_HISTORY_MAX_CHARS) break;
    history += turn.block;
  }
  return { threadId, history };
}

/**
 * Stores the replied-to inbound email's history block as the newest turn of its thread and maps
 * its Message-ID (and the ids it referenced) to the thread so the user's next reply finds it.
 * Prunes turns and mappings older than THREAD_HISTORY_RETENTION_MS.
 * @param sql - Agent SQL surface
 * @param parsedEmail - Parsed inbound email that was answered
 * @param block - Plain-text history block for this inbound email
 * @param existingThreadId - Thread id returned by loadThreadHistory, when one matched
 * @param now - Current epoch milliseconds
 */
export function recordThreadTurn(
  sql: ThreadSql,
  parsedEmail: ParsedEmailData,
  block: string,
  existingThreadId: string | undefined,
  now: number
): void {
  ensureThreadTables(sql);
  const ownId =
    parsedEmail.messageId && isValidMessageId(parsedEmail.messageId)
      ? parsedEmail.messageId
      : undefined;
  const linkedIds = getThreadMessageIds(parsedEmail);
  const threadId = existingThreadId ?? ownId ?? linkedIds[0];
  if (!threadId) return;

  void sql`INSERT INTO cafgpt_thread_turns (thread_id, created_at, block) VALUES (${threadId}, ${now}, ${block})`;
  for (const messageId of ownId ? [ownId, ...linkedIds] : linkedIds) {
    void sql`INSERT OR REPLACE INTO cafgpt_thread_messages (message_id, thread_id, created_at)
      VALUES (${messageId}, ${threadId}, ${now})`;
  }

  const cutoff = now - THREAD_HISTORY_RETENTION_MS;
  void sql`DELETE FROM cafgpt_thread_turns WHERE created_at < ${cutoff}`;
  void sql`DELETE FROM cafgpt_thread_messages WHERE created_at < ${cutoff}`;
}
