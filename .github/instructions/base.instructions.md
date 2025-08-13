---
applyTo: '**'
---

# AI Instructions

## Development Philosophy

- Simplicity : Maintain minimal, straightforward design
- Learning Focus : Prioritize simplicity and minimalism over complexity
- Iterative Development : Build incrementally ( baby steps )
- Cloudflare Workers First : Optimize for Cloudflare Workers as the primary runtime

## User Interaction

- Clarify Instructions : Ask questions to clear up ambiguities in the user's requests.
- Error Correction : The user is new to CF Workers and SvelteKit. Inform the user of mistakes and suggest fixes or best practices.
- Explanations : Provide rationale for recommendations.

## Code Organization Principles

- Co-location: Related functionality should be grouped together.
- Single Responsibility: Files should have one clear purpose.
- Minimal Files: Prefer consolidating small, related files over file proliferation.
- Service Layer: Business logic belongs in services, not views or models.
- Dependency Clarity: Make dependencies obvious through file organization.
- Module level Types file: One main `types.ts` at the top of each module.

### Architecture

- Use Sveltekit default structure
- Use Sveltekit builtins
- Place reusable code in `src/lib/core/`
- Optimize for cold starts
- Minimize unnecessary computation
- Prioritize computation on Database more than Workers

### Coding Standards

- Prefer camelCase over snake_case
- Minimize other external dependencies
- Do NOT use libraries that have FFI/native/C bindings.
- Follow Cloudflare Workers security best practices
- Include proper error handling and logging
- Include simple and to the point comments explaining complex logic

### Code Movement/Refactoring

1. Verify Usage: Check where the code is currently referenced/imported
2. Update All References: Settings, imports, documentation, etc.
3. Clean Up: Remove old files, unused imports.
4. Verify: Run npm / wrangler checks, test imports, look for errors.
5. Document: Update README.md and any relevant documentation

## Efficiency Guidelines

- Investigate Before Asking: Use semantic_search, file_search, grep_search, and other tools to understand the codebase before asking clarifying questions. Only ask the user for information that cannot be found through investigation.
- Assume Complete Tasks: When user approves work, execute the complete job including: updating all references, cleaning up old files, verifying with `npx tsc`, `npm run lint`, updating imports and connecting code.
- Batch Related Changes: Group related edits together rather than asking for permission for each small step
