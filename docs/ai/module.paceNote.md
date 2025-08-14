# PaceNote Module

> Domain: Performance Feedback | Status: Production Ready | Complexity: Medium

## Mission

Generate rank-aware performance feedback notes from observations using competency mappings.

## Context

- Location: `src/lib/modules/paceNote/`
- Entry: `service.ts` → `PaceNoteService`
- Related: `types.ts`, `constants.ts`, `prompts/`

## Contracts

- Input: `PaceNoteInput` (observation text, rank, optional member/period)
- Output: `PaceNoteOutput` (feedback note text, usage metrics)
- Side effects: LLM call via AI Gateway; static prompt imports

## Workflow

1. Validate inputs in route action (`form.server.ts`)
2. Call `PaceNoteService` with validated input
3. Render results; show usage metrics

## Constraints

- Adheres to [WORKERS_SAFE_LIBS](./core.md#workers_safe_libs)
- Follows [ENVIRONMENT_SETUP](./core.md#environment_setup)
- Uses [DB_ACCESS_PATTERN](./core.md#db_access_pattern)
- Prompt assets bundled statically

## Edge Cases

- Empty/short observations
- Unsupported rank
- LLM failure/timeouts

## Validation

- Unit tests for service; integration test via route form

## Related

- Parent: [PaceNote](./module.paceNote.md)
- Route: [Pacenote Route](./routes.md#pacenote-route)
