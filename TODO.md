# CAF-GPT TODO

This file tracks project-level work that should survive across coding sessions and agents. Keep it practical: items here should be specific enough for the next agent to pick up without reconstructing context from scratch.

## How to Use This File

- Put active work in `Active TODOs`.
- Move uncertain or lower-priority ideas to `Parking Lot`.
- Record completed work in `Log` with the date and a short outcome.

## Active TODOs

- [ ] 1. Adopt Cloudflare Agents SDK where it improves the coordinator model.
  - Context: `agents` is already in `package.json`, but the current Prime Foo flow uses direct AI SDK tool calls in `AgentCoordinator`. Introduce the Cloudflare Agents SDK deliberately rather than as an unused dependency.
  - Likely files: `package.json`, `src/agents/AgentCoordinator.ts`, `src/agents/sub-agents/*`, `src/agents/tools/*`, `tests/unit/*Agent*.test.ts`, `tests/integration/EmailHandler.test.ts`
  - Done when: There is a clear Cloudflare Agents SDK-backed orchestration path, tests cover the new lifecycle/tool behavior, and any unused direct-tooling or unused dependency surface is removed.

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
