# Memory: 8k reject loop + DO SQLite snapshots

Agreed 2026-08-29. Implemented 2026-08-30.

**Goal:** Hard 8k cap (error, not truncate) and last-N history on the SQLite the UserAgent DO already has.

**Now:** `{ memory: string }`; MemoryFoo is one `generateText`, no `execute`; `UserAgent` slices to 4000.

## Phase 1 — 8k reject + loop

- `src/agents/UserAgent.ts`: `MEMORY_MAX_CONTENT_LENGTH` 4000 → 8000. Delete the `substring` truncate. If MemoryFoo still returns `content.length > 8000`, do not `setState` (log, keep existing memory). Host enforces even if the loop fails.
- `src/agents/sub-agents/MemoryFooAgent.ts`: `execute` on `update_memory` errors if `content.length > 8000`. Loop with `stopWhen: stepCountIs(3)` (same breaker as Prime Foo). Keep `update_memory` / `leave_memory_unchanged`. Do not keep the old post-hoc `toolCalls` parse beside the loop.
- `public/prompts/memory_foo.md`: mention the 8000 cap (host still enforces).
- Tests: `tests/unit/MemoryFooAgent.test.ts`; any `UserAgent` test that assumes truncate.

**Done when:** oversize write is a tool error; a later under-cap write or `leave_memory_unchanged` can finish; memory is never sliced.

## Phase 2 — last-N on the same DO

Reuse `this.setState`. No D1, no Artifacts, no `this.sql` table.

- `UserAgentState`: `{ memory: string; versions: { ts: number; text: string }[] }`
- On a successful under-cap write: if previous `memory` is non-empty, push it onto `versions`; set new `memory`; drop oldest past N=10. Do not snapshot `""`.
- Prime Foo still reads only `this.state.memory`.
- Isolation stays one DO per sender.

**Done when:** ten prior snapshots exist after ten writes; eleventh drops the oldest; live string is still what Prime Foo sees.

## Not doing

Artifacts, git, `isomorphic-git`, D1, `str_replace`, Agent Memory, Vectorize, `AGENTS.md` until code lands.
