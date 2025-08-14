# PolicyFoo Module

> AI Agent Navigation | Status: Production Ready | Domain: Policy Q&A | Complexity: High

## Mission

Answer policy/regulation questions with authoritative citations via router-based architecture.

## Context

- Location: `src/lib/modules/policyFoo/`
- Entry: `index.ts` → `router`
- Related: `types.ts`, `handlers/`

## Contracts

- Input: `PolicyQueryInput` (messages, policy_set)
- Output: `PolicyQueryOutput` (XML response, usage)
- Side effects: DB reads via Hyperdrive; multiple LLM calls (multi-stage)

## Workflow

1. Receive chat message in route action and validate
2. Route to handler based on `policy_set`
3. Return XML response for UI parsing

## Constraints

- Adheres to [WORKERS_SAFE_LIBS](./core.md#workers_safe_libs)
- Follows [ENVIRONMENT_SETUP](./core.md#environment_setup)
- Uses [DB_ACCESS_PATTERN](./core.md#db_access_pattern)
- [Module-specific constraint]

## Edge Cases

- Unrecognized policy set
- No relevant policy content found
- Token budget exceeded

## Validation

- Handler unit tests and integration tests
- UI XML parsing tests

## Related

- Parent: [PolicyFoo](./module.policyFoo.md)
- Route: [Policy Route](./routes.md#policy-route)

## Links

- DOAD handler: `./module.policyFoo.doadFoo.md`
- LEAVE handler: `./module.policyFoo.leaveFoo.md`
- Route doc: `./routes.md#policy-route`
