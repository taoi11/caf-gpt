# Modules Handbook

> Single entry for all domain modules, optimized for LLM coding agents.

## PaceNote

- Mission: Rank-aware performance feedback generation from observations and competency mappings.
- Context: `src/lib/modules/paceNote/` (service.ts, types.ts, constants.ts, prompts/\*)
- Contracts:
  - Input: observation text; rank (Cpl, MCpl, Sgt, WO); optional member/period
  - Output: note text and usage metrics
- Constraints: Workers-safe deps; static prompt assets
- Steps: validate in route → `PaceNoteService` → render results (with usage)
- Edge cases: short input; unsupported rank; LLM timeouts/errors
- Validation: unit tests for service; integration via page action
- Links: Route → `./routes.md#pacenote-route`

## PolicyFoo

- Mission: Policy and regulation Q&A with authoritative citations using a router and specialized handlers.
- Context: `src/lib/modules/policyFoo/` (`index.ts`, `types.ts`, handlers under subfolders)
- Contracts:
  - Input: `PolicyQueryInput` (messages, policy_set)
  - Output: `PolicyQueryOutput` (XML response + usage)
- Constraints: Workers-safe libs; shared AI Gateway + DB service patterns
- Steps: route action validates → router selects handler by `policy_set` → return XML for UI parsing
- Edge cases: unknown policy set; empty search results; token budget exceeded
- Validation: handler unit tests; end-to-end XML parsing tests
- Links: Route → `./routes.md#policy-route`

### DOAD Handler

- Mission: Three-stage workflow (finder → metadata selector → main) to answer DOAD queries with citations.
- Context: `src/lib/modules/policyFoo/doadFoo/` (finder.ts, metadata-selector.ts, main.ts, database.service.ts)
- Performance (typical): tokens ~2.5k–4.5k, latency ~5–12s
- Constraints: Token budget exceeded; no relevant policy content found
- Links: Parent → `#policyfoo`, Route → `./routes.md#policy-route`

### LEAVE Handler

- Mission: Two-stage workflow (finder → main) to answer Leave policy queries with citations.
- Context: `src/lib/modules/policyFoo/leaveFoo/` (finder.ts, main.ts, database.service.ts)
- Performance (typical): tokens ~2k–3k, latency ~3–7s
- Constraints: Token budget exceeded; no relevant policy content found
- Links: Parent → `#policyfoo`, Route → `./routes.md#policy-route`
