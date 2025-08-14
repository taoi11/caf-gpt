## Parent Module
[PolicyFoo](./module.policyFoo.md)

## Mission

Two-stage LLM workflow to answer Leave policy questions with citations.

## Context

- Location: `src/lib/modules/policyFoo/leaveFoo/`
- Entry: `index.ts` → `handleLeaveQuery()`
- Related: `finder.ts`, `main.ts`, `database.service.ts`, `prompts/`

## Contracts

- Input: messages, policy_set="LEAVE"
- Output: XML with citations + usage
- Side effects: DB reads via Hyperdrive; multiple LLM calls

## Workflow

1. Finder: identify relevant chapters
2. Main agent: synthesize response as XML

## Constraints

- Adheres to [WORKERS_SAFE_LIBS](./core.md#workers_safe_libs)
- Follows [ENVIRONMENT_SETUP](./core.md#environment_setup)
- Uses [DB_ACCESS_PATTERN](./core.md#db_access_pattern)
- Reader model vs main model separation

## Edge Cases

- No relevant policy content found
- Token budget exceeded

## Validation

- Unit tests per agent; integration through handler

## Related

- Parent: [PolicyFoo](./module.policyFoo.md)
- Route: [Policy Route](./routes.md#policy-route)
