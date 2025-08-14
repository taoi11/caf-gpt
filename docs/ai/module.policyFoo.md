# PolicyFoo Module

> AI Agent Navigation | Status: Production Ready | Domain: Policy Q&A | Complexity: High

## Mission

Answer policy/regulation questions with authoritative citations via router-based architecture.

## Context

- Module: `src/lib/modules/policyFoo/`
- Router: `index.ts` delegates to handlers
- Handlers: `doadFoo/` (DOAD), `leaveFoo/` (LEAVE)
- Types: `types.ts`
- Route: `src/routes/policy/`

## Contracts

- Input: `PolicyQueryInput` (messages, policy_set)
- Output: `PolicyQueryOutput` (XML response, usage)
- Side effects: DB reads via Hyperdrive; multiple LLM calls (multi-stage)

## Constraints

- Workers-safe libraries
- Use shared AI Gateway service and DB service patterns

## Steps

1. Receive chat message in route action and validate
2. Route to handler based on `policy_set`
3. Return XML response for UI parsing

## Edge cases

- Unrecognized policy set
- No relevant policy content found
- Token budget exceeded

## Validation

- Handler unit tests and integration tests
- UI XML parsing tests

## Don’ts

- Don’t duplicate setup/testing → see `./core.md`, `./testing.md`

## Links

- DOAD handler: `./module.policyFoo.doadFoo.md`
- LEAVE handler: `./module.policyFoo.leaveFoo.md`
- Route doc: `./routes.md#policy-route`
