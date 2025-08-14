# Conventions Handbook

## Mission

Coding standards, naming conventions, and architectural patterns for consistent implementation across the codebase.

## Context

- Location: `docs/ai/Conventions.md`
- Related: `core.md`, `modules.md`
- Purpose: Single source of truth for development standards

## Code Organization

### Structure
- Follow SvelteKit defaults
- Co-locate routes with UI + server logic
- Domain modules in `src/lib/modules/*`
- Shared infrastructure in `src/lib/core/*`
- One main `types.ts` at the top of each module

### File Principles
- Single Responsibility: Each file should have one clear purpose
- Minimal Files: Prefer consolidating small, related files over proliferation
- Co-location: Group related functionality together
- Dependency Clarity: Make dependencies obvious through file organization

## Naming, Style and Comments

- Use camelCase for variables, functions, and methods
- Strict TypeScript with explicit types
- Minimal external dependencies
- No libraries with FFI/native/C bindings
- Validate environment early in execution paths
- Simple, to-the-point comments explaining complex logic
- 2-3 sentence summaries comments at the top of each file `/** ... */`
- single line comments for all functions and methods `// ...`

## Architecture

- Service Layer: Business logic belongs in services, not views or models
- Database First: Prefer computation on Database over Worker compute
- Cold Start Optimization: Minimize unnecessary computation
- Reusable Code: Place shared functionality in `src/lib/core/`
- Use SvelteKit builtins where appropriate

## Security

- Server-only LLM calls (never client-side)
- Validate all inputs at boundaries
- Prefer SSR and form actions
- Never log secrets
- Sanitize LLM output
- Follow Cloudflare Workers security best practices

## Error Handling

- Consistent error structures with clear codes
- Track usage metrics with all AI operations
- Monitor query performance and database indexes
- Handle edge cases explicitly (empty inputs, timeouts, etc.)
- Include proper logging with context

## Code Movement & Refactoring

1. **Verify Usage**: Check where code is referenced/imported
2. **Update References**: Update all settings, imports, and documentation
3. **Clean Up**: Remove old files and unused imports
4. **Verify**: Run `npx tsc`, `npm run lint`, and test imports
5. **Document**: Update relevant documentation in `docs/ai/`

## Related

- Core: [Core Handbook](./core.md)
- Modules: [Modules Handbook](./modules.md)
- Testing: [Testing Guide](./testing.md)
