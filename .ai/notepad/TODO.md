# TODO

## General
[x] optimize web pages for tablet screens
- mostly done
- debug needed:
  - [ ] headers and footers should collapse on first message sent

[x] llm research progress emiter for policyFoo web page - **REMOVED: SSE/streaming code stripped out**
- Unnecessary acomplexity

[ ] Move from R2 to Postgres
  - [x] PolicyFoo
  - [ ] PaceNote
    - Planning needed
## Code Organization & Refactoring

[ ] Trim large source files (>150 lines) for better maintainability

- Current large files identified in `.ai/notepad/large-src-files.md`
- Target files to refactor:
  - [ ] `/src/lib/modules/policyFoo/leaveFoo/database.service.ts` (215 lines)
  - [ ] `/src/lib/server/ai-gateway.service.ts` (207 lines)
  - [ ] `/src/lib/modules/policyFoo/doadFoo/database.service.ts` (200 lines)
  - [ ] `/src/lib/modules/paceNote/service.ts` (190 lines)
  - [ ] `/src/routes/pacenote/PaceNoteForm.svelte` (155 lines)
  - [ ] `/src/lib/modules/policyFoo/doadFoo/main.ts` (152 lines)
