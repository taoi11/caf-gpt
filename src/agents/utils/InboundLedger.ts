/**
 * src/agents/utils/InboundLedger.ts
 *
 * Per-user ledger of Resend inbound email ids already accepted, kept in the UserAgent DO's
 * SQLite so a webhook retry or a manual replay of the same email never gets a second reply.
 * Resend retries a failed delivery for about a day and a half and allows manual replays, so ids
 * are kept for THREAD_HISTORY_RETENTION_MS (30 days). Only opaque Resend ids and times are stored.
 * Docs: https://resend.com/docs/webhooks/retries-and-replays
 *
 * Top-level declarations:
 * - claimInboundEmail: Records an email id; false when it was already recorded
 * - releaseInboundEmail: Removes a claim whose processing could not be scheduled
 * - pruneInboundLedger: Deletes expired ids; returns the rows left
 */

import { THREAD_HISTORY_RETENTION_MS, type ThreadSql } from "./ThreadHistory";

/** Creates the ledger table if it does not exist yet (idempotent). */
function ensureLedgerTable(sql: ThreadSql): void {
  void sql`CREATE TABLE IF NOT EXISTS cafgpt_resend_inbound (
    email_id TEXT PRIMARY KEY,
    received_at INTEGER NOT NULL
  )`;
}

/**
 * Records a Resend inbound email id. A DO runs one request's synchronous code at a time, so the
 * check and insert cannot interleave with another delivery of the same id.
 * @param sql - Agent SQL surface
 * @param emailId - Resend email id from the webhook
 * @param now - Current epoch milliseconds
 * @returns True when the id is new (process it), false for a duplicate delivery
 */
export function claimInboundEmail(sql: ThreadSql, emailId: string, now: number): boolean {
  pruneInboundLedger(sql, now);

  const existing = sql<{
    count: number;
  }>`SELECT COUNT(*) AS count FROM cafgpt_resend_inbound WHERE email_id = ${emailId}`;

  if ((existing[0]?.count ?? 0) > 0) return false;
  void sql`INSERT INTO cafgpt_resend_inbound (email_id, received_at) VALUES (${emailId}, ${now})`;

  return true;
}

/**
 * Removes a claim, so a later webhook retry can process the email when scheduling it failed.
 * @param sql - Agent SQL surface
 * @param emailId - Resend email id from the webhook
 */
export function releaseInboundEmail(sql: ThreadSql, emailId: string): void {
  ensureLedgerTable(sql);
  void sql`DELETE FROM cafgpt_resend_inbound WHERE email_id = ${emailId}`;
}

/**
 * Deletes ledger rows older than THREAD_HISTORY_RETENTION_MS.
 * @param sql - Agent SQL surface
 * @param now - Current epoch milliseconds
 * @returns Number of ids still stored
 */
export function pruneInboundLedger(sql: ThreadSql, now: number): number {
  ensureLedgerTable(sql);
  void sql`DELETE FROM cafgpt_resend_inbound WHERE received_at < ${now - THREAD_HISTORY_RETENTION_MS}`;

  return sql<{ count: number }>`SELECT COUNT(*) AS count FROM cafgpt_resend_inbound`[0]?.count ?? 0;
}
