# LEAVE PolicyFoo Handler

> AI Agent Navigation | Status: Production Ready | Complexity: Medium (2-stage)

## Mission

Two-stage LLM workflow to answer Leave policy questions with citations.

## Context

- Directory: `src/lib/modules/policyFoo/leaveFoo/`
- Entry: `index.ts` → `handleLeaveQuery()`
- Agents: `finder.ts`, `main.ts`
- DB: `database.service.ts`
- Prompts: `prompts/*`

## Workflow

1. Finder: identify relevant chapters
2. Main agent: synthesize response as XML

## Contracts

- Input: messages, policy_set="LEAVE"
- Output: XML with citations + usage

## Constraints

- Reader model vs main model separation
- DB via Hyperdrive

## Performance

- Tokens: ~2000-3000
- Latency: ~3-7s

## Validation

- Unit tests per agent; integration through handler

## Links

- Parent module: `./module.policyFoo.md`
- Route doc: `./routes.md#policy-route`
