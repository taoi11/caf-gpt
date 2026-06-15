# CAF-GPT TODO

This file tracks project-level work that should survive across coding sessions and agents. Keep it practical: items here should be specific enough for the next agent to pick up without reconstructing context from scratch.

## How to Use This File

- Put active work in `Active TODOs`.
- Move uncertain or lower-priority ideas to `Parking Lot`.
- Record completed work in `Log` with the date and a short outcome.

## Active TODOs

- [ ] 1. Replace DOAD/QR&O selector-loader-answer flow with a one-agent tool-reading pattern.
  - Context: Keep `DoadFooAgent` and `QroFooAgent` as separate sub-agents with separate index files. Defer markdown table re-engineering for now. The immediate change is to give each agent its index up front and a validated `read_file` tool it can call up to three times before answering.
  - Current mappings: DOAD should continue selecting by DOAD ID and mapping to `${id}.md`; QR&O should continue selecting by file path exactly as it does today.
  - Likely files: `src/agents/utils/TwoCallAgent.ts` or a replacement utility, `src/agents/sub-agents/DoadFooAgent.ts`, `src/agents/sub-agents/QroFooAgent.ts`, `src/schemas.ts`, `public/prompts/doad_foo_selector.md`, `public/prompts/qro_foo_selector.md`, related unit tests.
  - Done when: DOAD and QR&O each make one model call with a domain index plus a `read_file` tool, validate tool inputs against the current index/mapping, cap successful reads at three, and answer only from files read.

## Parking Lot

- [ ] 1. Rework DOAD and QR&O indexes into a shared manifest table shape.
  - Context: Standardize the separate sub-agent indexes to a clean markdown table with `| Id | Title | File |`. This is intentionally deferred until after the one-agent tool-reading pattern is in place.
  - Likely files: DOAD index asset, QR&O index document, selector/tool-reading prompts, any manifest parsing helpers.
  - Done when: Both domain indexes use the same table shape, DOAD and QR&O file validation can use a common manifest parser, and agent behavior is unchanged except for simpler index handling.

- [ ] 2. Plan manual document chunking and migration from R2-only retrieval to Neon pgvector.
  - Context: Keep R2 path-based retrieval for now. Future work should manually chunk CAF policy docs, store embeddings in Neon pgvector, and decide whether R2 remains the source of truth for full documents.
  - Likely files: `src/storage/DocumentRetriever.ts`, `src/agents/utils/TwoCallAgent.ts`, `src/agents/sub-agents/*`, future database migration/seed scripts
  - Done when: Chunking strategy, schema, embedding model, retrieval ranking, citation format, and backfill process are designed before implementation begins.

- [ ] 3. Revisit no-degraded-mode boundaries after memory and email rewrites.
  - Context: The project rule is no degraded behavior within logic modules. Outer orchestration may intentionally skip optional modules only when explicit, tested, and documented.
  - Likely files: `AGENTS.md`, `src/agents/UserAgent.ts`, tests around memory failure handling
  - Done when: Module-level failure contracts are documented in code/tests and orchestration-level optional behavior is named rather than accidental.

## Log

### 2026-06-03

- Migrated the email spine to Cloudflare Agents SDK: added `UserAgent` as a Durable Object-backed per-user agent keyed by normalized full sender email, routed inbound mail through `routeAgentEmail`, and signed replies with `EMAIL_SECRET`.
- Moved user memory from Hyperdrive/Postgres to Agent state, replaced `ctx.waitUntil` memory writes with durable `this.schedule("runMemoryUpdate")`, removed Hyperdrive/Postgres code and bindings, and chose lazy memory rebuild with no Neon backfill.
- Removed unwired tool factories, legacy iteration middleware, stale email sender/threading handlers, and stale test mocks; added Workers-pool Durable Object tests for routing, signed replies, scheduling, and state updates.

### 2026-06-02

- Reworked outbound email for Cloudflare Email Service: added the `send_email` binding, switched normal/error replies to structured `env.EMAIL.send()`, preserved inbound CC parsing, added authorization-allowlisted reply-all CC handling for normal replies, and kept error responses sender-only.
- Reviewed Cloudflare Workers platform configuration before deploy: moved the compatibility date forward, kept `nodejs_compat` and assets intentionally, made observability sampling explicit, cleaned up generated-versus-manual Env typing, and documented required secrets.
- Created the project TODO structure for cross-session task tracking.
