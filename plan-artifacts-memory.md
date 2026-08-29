# Artifacts memory

Agreed 2026-08-29. Do not implement from this file until a later ask.

**Goal:** Per-sender git history for memory, plus an 8k hard cap that rejects oversize writes so MemoryFoo retries shorter.

**Now:** one `UserAgent` DO per sender; `{ memory: string }`; MemoryFoo is a single `generateText` with `update_memory` / `leave_memory_unchanged` and no `execute`; `UserAgent` silently truncates to 4000.

## Phase 1 — 8k reject + loop (no Artifacts)

Does not wait on account access.

- `src/agents/UserAgent.ts`: `MEMORY_MAX_CONTENT_LENGTH` 4000 → 8000. Delete the `substring` truncate in `runMemoryUpdate`.
- `src/agents/sub-agents/MemoryFooAgent.ts`: `execute` on `update_memory` returns an error if `content.length > 8000`. Bounded tool loop (`stopWhen: stepCountIs(3)`, same breaker as Prime Foo). Keep the two existing tools. No `str_replace`.
- `public/prompts/memory_foo.md`: state the 8000 hard cap (host still enforces).
- Tests: `tests/unit/MemoryFooAgent.test.ts`; any `UserAgent` test that assumes truncate.

**Done when:** oversize write is a tool error; a later under-cap `update_memory` or `leave_memory_unchanged` can finish the loop; memory is never sliced.

## Phase 2 — Artifacts

**Blocker:** Artifacts enabled on the Cloudflare account.

https://developers.cloudflare.com/artifacts/

- `wrangler.jsonc`: `[[artifacts]]` binding, namespace `caf-gpt`.
- One repo per sender. Name `u-` + hex hash (emails are not legal repo names).
- One file: `MEMORY.md`.
- DO string stays the hot copy Prime Foo injects. Do not clone on inbound mail.
- After a successful under-cap update, the **host** commits `MEMORY.md`. MemoryFoo does not get git tools.
- Binding cannot write files. Commit from the existing `schedule` → `runMemoryUpdate` path via `isomorphic-git`.
- Create the repo on first successful write.
- Commit failure: same as today — memory is optional; reply already sent.

**Done when:** each sender has one repo; each accepted memory write is a commit of `MEMORY.md`; Prime Foo still reads `this.state.memory`.

## Not doing

`str_replace`, git-notes, branches/forks, Agent Memory, Vectorize, R2 copies, `AGENTS.md` until code lands.
