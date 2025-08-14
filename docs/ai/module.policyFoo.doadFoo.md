
## Mission

Three-stage LLM workflow to answer DOAD policy questions with citations.

## Context

- Location: `src/lib/modules/policyFoo/doadFoo/`
- Entry: `index.ts` → `handleDOADQuery()`
- Related: `finder.ts`, `metadata-selector.ts`, `main.ts`, `database.service.ts`, `prompts/`

## Contracts

- Input: messages, policy_set="DOAD"
- Output: XML with citations + usage
- Side effects: DB reads via Hyperdrive; multiple LLM calls

## Workflow

1. Finder: identify DOAD policy numbers
2. Metadata selector: choose relevant chunks
3. Main agent: synthesize final XML response

## Constraints

- Adheres to all [Core Platform Constraints](./core.md#platform-constraints)
- Reader model vs main model separation

## Validation

- Unit tests per agent; integration through handler

## Related

- Parent: [PolicyFoo](./module.policyFoo.md)
- Route: [Policy Route](./routes.md#policy-route)
