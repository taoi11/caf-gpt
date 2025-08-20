# Routes Handbook

> One page for all routes, wired for LLM agents.

## Pacenote Route

- Mission: Form-based UI to submit observations and show generated feedback.
- Context: `src/routes/pacenote/` (server: `+page.server.ts`; UI: `+page.svelte`, `PaceNoteForm.svelte`, `PaceNoteResults.svelte`, `PaceNoteTips.svelte`; helpers: `form.server.ts`, `ui.ts`, `config.server.ts`)
- Flow: user fills form → server validates → call PaceNoteService → render note + usage
- Contracts: input (observation, rank, optional fields); output (note + usage)
- Edge cases: validation errors; LLM failure
- Links: Module → `./modules.md#pacenote`

## Policy Route

- Mission: Chat UI to process messages, route to policy handlers, and render structured (XML) responses with citations.
- Context: `src/routes/policy/` (server: `+page.server.ts`; UI: `PolicyComponents/*`)
- Flow: user types message + selects policy set → server action routes to handler → receives XML → components parse and render
- Edge cases: malformed XML; mid-chat policy set changes
- Links: Module → `./modules.md#policyfoo`
