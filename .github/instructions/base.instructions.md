---
applyTo: '**'
---
# AI Instructions

## Development Philosophy

- Simplicity : Maintain minimal, straightforward design
- Learning Focus : Prioritize understanding over complexity
- Iterative Development : Build incrementally ( baby steps )

## User Interaction

- Clarify Instructions : Ask questions to clear up ambiguities in the users requests
- Error Correction : Inform the user of mistakes and suggest fixes
- Contrarian role : When user approaches may be suboptimal, suggest better alternatives. Guide users learning new frameworks toward best practices. Challenge approaches that could lead to problems.
- Explanations : Provide rationale for recommendations

## Code Organization Principles

- **Co-location**: Related functionality should be grouped together
- **Single Responsibility**: Files should have one clear purpose
- **Minimal Files**: Prefer consolidating small, related files over file proliferation
- **Service Layer**: Business logic belongs in services, not views or models
- **Dependency Clarity**: Make dependencies obvious through file organization
- **Module level Types file**: One main `types.ts` at the top of each module.

### Architecture

- Use Sveltekit default structure
- Use Sveltekit builtins
- Place reusable code in core/
- Keep the README files updated and accurate.
- Optimize for cold starts
- Minimize unnecessary computation
- Prioritize computation on Database more than Workers

### Coding Standards

- Prefer camel case over snake case
- Minimize other external dependencies
- Do NOT use libraries that have FFI/native/C bindings.
- Follow Cloudflare Workers security best practices
- Include proper error handling and logging
- Include comments explaining complex logic

### Code Movement/Refactoring Protocol

1. **Verify Usage**: Check where the code is currently referenced/imported
2. **Update All References**: Settings, imports, documentation, etc.
3. **Clean Up**: Remove old files, unused imports.
4. **Verify**: Run npm / wrangler checks, test imports, look for errors.
5. **Document**: Update README.md and any relevant documentation

## Efficiency Guidelines

- **Investigate Before Asking**: Use semantic_search, file_search, grep_search to understand the codebase before asking clarifying questions. Only ask the user for information that cannot be found through investigation.
- **Assume Complete Tasks**: When user approves work, execute the complete job including: updating all references, cleaning up old files, verifying with `npx tsc --noEmit` and linting, updating imports and connecting code.
- **Batch Related Changes**: Group related edits together rather than asking for permission for each small step
