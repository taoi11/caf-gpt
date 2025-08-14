# DOAD PolicyFoo Handler

> AI Agent Navigation | Status: Production Ready | Complexity: High (3-stage)

## Mission

Three-stage LLM workflow to answer DOAD policy questions with citations.

## Context

- Directory: `src/lib/modules/policyFoo/doadFoo/`
- Entry: `index.ts` → `handleDOADQuery()`
- Agents: `finder.ts`, `metadata-selector.ts`, `main.ts`
- DB: `database.service.ts`
- Prompts: `prompts/*`

## Workflow

1. Finder: identify DOAD policy numbers
2. Metadata selector: choose relevant chunks
3. Main agent: synthesize final XML response

## Contracts

- Input: messages, policy_set="DOAD"
- Output: XML with citations + usage

## Constraints

- Reader model vs main model separation
- DB via Hyperdrive

## Performance

- Tokens: ~2500-4500
- Latency: ~5-12s

## Validation

- Unit tests per agent; integration through handler

## Links

- Parent module: `./module.policyFoo.md`
- Route doc: `./routes.md#policy-route`
