# CAF-GPT TODO

This file tracks project-level work that should survive across coding sessions and agents. Keep it practical: items here should be specific enough for the next agent to pick up without reconstructing context from scratch.

## How to Use This File

- Put active work in `Active TODOs`.
- Move uncertain or lower-priority ideas to `Parking Lot`.
- Record completed work in `Log` with the date and a short outcome.

## Active TODOs

- [ ] Review Cloudflare Workers platform configuration before the next deploy.
  - Context: `compatibility_date`, `nodejs_compat`, assets, observability traces, R2, Hyperdrive, and generated Worker types are all platform-churn surfaces. Traces became a cost/volume consideration and should not stay enabled by accident.
  - Likely files: `wrangler.jsonc`, `worker-configuration.d.ts`, `src/env.d.ts`, `README.md`
  - Done when: Compatibility date and flags are intentionally current, observability settings are cost-aware, `wrangler types --check --env-interface CloudflareBindings` passes, and docs list the real required secrets.

- [ ] Rework outbound email on Cloudflare's newer email APIs and support reply-all behavior.
  - Context: Current implementation uses Email Workers `message.reply()` and sends sender-only replies. The next email layer should support CC/reply-all style behavior where safe and explicitly intended.
  - Likely files: `src/email/CloudflareEmailSender.ts`, `src/email/types.ts`, `src/email/components/EmailThreadManager.ts`, `src/email/components/EmailComposer.ts`, `src/email/CloudflareEmailWorkerHandler.ts`, `tests/integration/EmailHandler.test.ts`
  - Done when: Normal replies can include appropriate original CC recipients, tests cover sender-only versus reply-all behavior, threading headers remain correct, and authorization/loop-guard rules prevent accidental broad replies.

- [ ] Adopt Cloudflare Agents SDK where it improves the coordinator model.
  - Context: `agents` is already in `package.json`, but the current Prime Foo flow uses direct AI SDK tool calls in `AgentCoordinator`. Introduce the Cloudflare Agents SDK deliberately rather than as an unused dependency.
  - Likely files: `package.json`, `src/agents/AgentCoordinator.ts`, `src/agents/sub-agents/*`, `src/agents/tools/*`, `tests/unit/*Agent*.test.ts`, `tests/integration/EmailHandler.test.ts`
  - Done when: There is a clear Cloudflare Agents SDK-backed orchestration path, tests cover the new lifecycle/tool behavior, and any unused direct-tooling or unused dependency surface is removed.

## Parking Lot

- [ ] Plan manual document chunking and migration from R2-only retrieval to Neon pgvector.
  - Context: Keep R2 path-based retrieval for now. Future work should manually chunk CAF policy docs, store embeddings in Neon pgvector, and decide whether R2 remains the source of truth for full documents.
  - Likely files: `src/storage/DocumentRetriever.ts`, `src/storage/database.ts`, `src/agents/utils/TwoCallAgent.ts`, `src/agents/sub-agents/*`, future migration/seed scripts
  - Done when: Chunking strategy, schema, embedding model, retrieval ranking, citation format, and backfill process are designed before implementation begins.

- [ ] Revisit no-degraded-mode boundaries after memory and email rewrites.
  - Context: The project rule is no degraded behavior within logic modules. Outer orchestration may intentionally skip optional modules only when explicit, tested, and documented.
  - Likely files: `AGENTS.md`, `src/email/SimpleEmailHandler.ts`, `src/storage/MemoryRepository.ts`, tests around memory failure handling
  - Done when: Module-level failure contracts are documented in code/tests and orchestration-level optional behavior is named rather than accidental.

## Log

### 2026-06-02

- Created the project TODO structure for cross-session task tracking.
