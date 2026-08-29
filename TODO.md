# CAF-GPT TODO

This file tracks project-level work that should survive across coding sessions and agents. Keep it practical: items here should be specific enough for the next agent to pick up without reconstructing context from scratch.

## How to Use This File

- Put active work in `Active TODOs`.
- Move uncertain or lower-priority ideas to `Parking Lot`.
- Record completed work in `Log` with the date and a short outcome.

## Active TODOs

- [ ] 1. Artifacts memory (8k reject loop + per-user Artifacts repo).
  - Plan: `plan-artifacts-memory.md`
  - Likely files: listed in that plan
  - Done when: both phases in the plan are implemented. This pointer is not the work.

## Parking Lot

None.

## Log

### 2026-08-29

- Dropped the Neon pgvector parking-lot item. Retrieval stays R2 path-based.

### 2026-08-21

- Reworked the DOAD and QR&O indexes into one shared manifest table shape (`| Id | Title | File |`) with a common parser in `src/agents/utils/ManifestParser.ts`. `ToolReadingAgent` now builds the Id→File allowlist from the manifest for both domains; per-domain parsing (DOAD id regex, QR&O list/table path parser) was deleted, and the QR&O path-safety rules (no absolute, dot/empty segments, backslash, or traversal) moved to the shared validators. The DOAD table asset gained its File column; the QR&O index is R2-only and must be rewritten to the table shape and re-uploaded before deploying this branch.

### 2026-07-20

- Simplified email delivery for the hobby-project scope: authorized inbound mail now routes directly by normalized envelope sender, successful responses use the official Agents SDK `sendEmail()` helper, and generic pre-send error responses use `replyToEmail()`.
- Reworked reply-all to mirror normal email clients: valid `Reply-To` mailboxes are primary recipients, original `To` then `Cc` participants are preserved after safety filtering, and valid external recipients are allowed.
- Removed signed routing, the durable delivery ledger, fingerprint-bearing memory tasks, detailed tracing, and failover state machinery. Duplicate inbound delivery is now an accepted tradeoff.

### 2026-07-16

- Kept sender authorization as a code-reviewed non-overridable policy, added strict outbound header validation, and changed coordinator/specialist failures to reach the sender-only error boundary without degraded model content.
- Closed the no-degraded-mode boundary review by documenting and testing that core email processing fails cleanly while post-send scheduled memory updates remain independently retryable.

### 2026-06-15

- Replaced the DOAD/QR&O selector-loader-answer flow with a one-call tool-reading pattern: each specialist now receives its index up front, validates `read_file` requests against that index, caps reads at three successful documents and five total attempts, and fails cleanly after the correction budget is exhausted.

### 2026-06-03

- Migrated the email spine to Cloudflare Agents SDK: added `UserAgent` as a Durable Object-backed per-user agent keyed by normalized full sender email and routed inbound mail through `routeAgentEmail`.
- Moved user memory from Hyperdrive/Postgres to Agent state, replaced `ctx.waitUntil` memory writes with durable `this.schedule("runMemoryUpdate")`, removed Hyperdrive/Postgres code and bindings, and chose lazy memory rebuild with no Neon backfill.
- Removed unwired tool factories, legacy iteration middleware, stale email sender/threading handlers, and stale test mocks; added Workers-pool Durable Object tests for routing, reply sending, scheduling, and state updates.

### 2026-06-02

- Reworked outbound email for Cloudflare Email Service: added the `send_email` binding, preserved inbound CC parsing, added reply-all CC handling for normal replies, and kept error responses sender-only.
- Reviewed Cloudflare Workers platform configuration before deploy: moved the compatibility date forward, kept `nodejs_compat` and assets intentionally, cleaned up generated-versus-manual Env typing, and documented required secrets.
- Created the project TODO structure for cross-session task tracking.
