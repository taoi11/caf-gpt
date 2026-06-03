# CAF-GPT TODO

This file tracks project-level work that should survive across coding sessions and agents. Keep it practical: items here should be specific enough for the next agent to pick up without reconstructing context from scratch.

## How to Use This File

- Put active work in `Active TODOs`.
- Move uncertain or lower-priority ideas to `Parking Lot`.
- Record completed work in `Log` with the date and a short outcome.

## Active TODOs

- [ ] 1. Go Cloudflare Agents SDK-first: offload application plumbing to the `agents` runtime.
  - Decision (2026-06-02): Adopt the Cloudflare Agents SDK as the primary orchestration/runtime layer, not just where it marginally helps. The `Agent` class is Durable Object-backed, so this introduces stateful, addressable, durable agents.
  - Current state of the SDK in this repo: `agents` ^0.7.6 is in `package.json` but has **zero imports anywhere in `src/`** — it is a completely unused dependency. All orchestration today runs on the Vercel AI SDK (`ai`): `generateText` + inline `tool()` + `stopWhen: stepCountIs(3)` in `AgentCoordinator`, with model calls routed through Cloudflare AI Gateway via `ai-gateway-provider`. There are no Durable Objects, queues, cron triggers, or `scheduled` handler today.
  - Offload candidates (current implementation → SDK target):
    - Per-user memory/state: Neon Postgres via Hyperdrive (`MemoryRepository`, keyed by email local-part) → SDK agent state (`this.setState`/`this.state`) and/or embedded SQLite (`this.sql`). Decide whether Neon stays as system-of-record.
    - Inbound email routing: hand-rolled `CloudflareEmailWorkerHandler` (postal-mime parse + allowlist) → SDK email routing primitives (verify `routeAgentEmail`/`onEmail` exist and fit).
    - Deferred memory write: fragile `ctx.waitUntil` fire-and-forget in `SimpleEmailHandler` (lost on Worker timeout) → durable `this.schedule()` task.
    - Coordinator instance caching: module-level `Map<string, AgentCoordinator>` keyed `"main"` to survive isolate reuse → a real DO-backed agent instance.
    - Missing retry/dedup/queue surface today → evaluate what the SDK's durability + scheduling can provide.
    - Note: the AI SDK tool loop (`batch_research`, `generate_feedback_note`) can likely run *inside* an Agent rather than being replaced — confirm composition with the SDK.
  - Cleanup surface noted this session (not yet done): `src/agents/tools/batchResearchTool.ts` + `feedbackNoteTool.ts` factories appear unwired (coordinator defines tools inline); `iterationTracker` middleware is a legacy artifact superseded by `stepCountIs(3)`; stale `BUCKET` field in `tests/mocks/cloudflare.ts`.
  - Required to use the SDK at all (verify in research): `durable_objects` binding + `migrations` in `wrangler.jsonc`, compatibility flags. None exist yet.
  - Likely files: `package.json`, `wrangler.jsonc`, `src/index.ts`, `src/agents/AgentCoordinator.ts`, `src/agents/sub-agents/*`, `src/agents/tools/*`, `src/email/CloudflareEmailWorkerHandler.ts`, `src/email/SimpleEmailHandler.ts`, `src/storage/MemoryRepository.ts`, `tests/unit/*Agent*.test.ts`, `tests/integration/EmailHandler.test.ts`
  - Research: COMPLETE (2026-06-02, verified vs developers.cloudflare.com/agents + github.com/cloudflare/agents). Confirmed first-class email support (`routeAgentEmail`, `onEmail`, `this.sendEmail`/`replyToEmail`, HMAC reply routing via `createSecureReplyEmailResolver`), per-instance state (`setState`/`this.sql`), durable scheduling (`this.schedule`/`queue`/`retry`), and that the Agent is a Durable Object addressed by name (`getAgentByName`). The AI SDK tool loop runs INSIDE an Agent unchanged (SDK composes with `ai`, does not replace it). SDK does NOT parse MIME (keep postal-mime) and has no opinion on CAF authorization/CC business logic (keep it).
  - Decisions (2026-06-02): (a) Per-user memory moves FULLY to agent SQLite/state — drop the Neon `memory` table, `MemoryRepository`, `database.ts`, and the Hyperdrive binding. (b) Plan-only for now; implement in stages after review.
  - Target shape: one `UserAgent` Durable Object per sender, keyed via a custom resolver in the `email()` export. `onEmail` does parse (postal-mime) → loop-guard/validate → read `this.state.memory` → `AgentCoordinator.processWithPrimeFoo` (kept) → reply via `this.sendEmail` (kept CC-allowlist logic) → `this.schedule("runMemoryUpdate")` (replaces fragile `ctx.waitUntil`). `runMemoryUpdate` runs `MemoryFooAgent` → `setState({ memory })`.
  - Migration stages: 0) wrangler DO binding + `new_sqlite_classes` migration + `UserAgent` skeleton + type regen (no behavior change). 1) Email spine: route inbound → `onEmail`, port parse/business-logic/tool-loop/outbound; keep memory on Neon temporarily to isolate. 2) Memory → `this.state`; `ctx.waitUntil` → `this.schedule`; delete `MemoryRepository`/`database.ts`; drop Hyperdrive. 3) Cleanup dead code + migrate test infra.
  - Test infra note: properly testing the DO wants `@cloudflare/vitest-pool-workers` (`cloudflare:test`, `runInDurableObject`) — a real change from the current plain-Vitest + hand-mock setup. Rewrite `tests/integration/EmailHandler.test.ts` around `UserAgent.onEmail`; delete `MemoryRepository.test.ts`; sub-agent/tool unit tests stay.
  - Open decisions before/at implementation: (1) existing Neon memory backfill — lazy rebuild (loses history) vs one-time export+seed; (2) instance key — local-part (current, collides across domains) vs full normalized email (fixes latent bug, changes behavior); (3) `EmailThreadManager` — retire in favor of SDK HMAC reply routing vs keep for `References` continuity.
  - Done when: `UserAgent` owns the email spine + per-user state on agent SQLite, wrangler has DO/`new_sqlite_classes` bindings (Hyperdrive removed), durable scheduling replaces `ctx.waitUntil`, tests cover the new lifecycle/state/scheduling under pool-workers, and the unused tooling + previously-unused `agents` dependency surface are reconciled.

## Parking Lot

- [ ] 1. Plan manual document chunking and migration from R2-only retrieval to Neon pgvector.
  - Context: Keep R2 path-based retrieval for now. Future work should manually chunk CAF policy docs, store embeddings in Neon pgvector, and decide whether R2 remains the source of truth for full documents.
  - Likely files: `src/storage/DocumentRetriever.ts`, `src/storage/database.ts`, `src/agents/utils/TwoCallAgent.ts`, `src/agents/sub-agents/*`, future migration/seed scripts
  - Done when: Chunking strategy, schema, embedding model, retrieval ranking, citation format, and backfill process are designed before implementation begins.

- [ ] 2. Revisit no-degraded-mode boundaries after memory and email rewrites.
  - Context: The project rule is no degraded behavior within logic modules. Outer orchestration may intentionally skip optional modules only when explicit, tested, and documented.
  - Likely files: `AGENTS.md`, `src/email/SimpleEmailHandler.ts`, `src/storage/MemoryRepository.ts`, tests around memory failure handling
  - Done when: Module-level failure contracts are documented in code/tests and orchestration-level optional behavior is named rather than accidental.

## Log

### 2026-06-02

- Reworked outbound email for Cloudflare Email Service: added the `send_email` binding, switched normal/error replies to structured `env.EMAIL.send()`, preserved inbound CC parsing, added authorization-allowlisted reply-all CC handling for normal replies, and kept error responses sender-only.
- Reviewed Cloudflare Workers platform configuration before deploy: moved the compatibility date forward, kept `nodejs_compat` and assets intentionally, made observability sampling explicit, cleaned up generated-versus-manual Env typing, and documented required secrets.
- Created the project TODO structure for cross-session task tracking.
