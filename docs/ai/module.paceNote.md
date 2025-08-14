# PaceNote Module

> AI Agent Navigation | Status: Production Ready | Domain: Performance Feedback

## Mission

Generate rank-aware performance feedback notes from observations using competency mappings.

## Context

- Module: `src/lib/modules/paceNote/`
- Entry: `service.ts` → `PaceNoteService`
- Types: `types.ts` → `PaceNoteInput`, `PaceNoteOutput`, `PaceNoteRank`
- Prompts: `prompts/base.md`, `prompts/competencies/*`
- Route: `src/routes/pacenote/`
- Key files: `service.ts`, `constants.ts`, `types.ts`, `prompts/base.md`, `prompts/competencies/*`

## Contracts

- Input: observation text, rank (Cpl, MCpl, Sgt, WO), optional member and period
- Output: feedback note text and usage metrics
- Side effects: LLM call via AI Gateway; static prompt imports

## Constraints

- Workers-safe libs only; no native/FFI
- Prompt assets bundled statically

## Steps

1. Validate inputs in route action (`form.server.ts`)
2. Call `PaceNoteService` with validated input
3. Render results; show usage metrics

## Edge cases

- Empty/short observations
- Unsupported rank
- LLM failure/timeouts

## Validation

- Unit tests for service; integration test via route form

## Don’ts

- Don’t duplicate setup here → see `./core.md`
- Don’t inline prompt text in docs → link to files

## Links

- Module: `src/lib/modules/paceNote/`
- Route doc: `./routes.md#pacenote-route`
