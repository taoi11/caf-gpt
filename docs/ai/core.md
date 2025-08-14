# Core Handbook

Mission: Shared, non-domain foundations for AI, DB, and platform conventions.

## Context

- Location: `src/lib/core/`
- Key files: `ai-gateway.service.ts`, `db/client.ts`, `db/service.ts`, `types.ts`

---

## AI Gateway

Mission: Central entry point for LLM calls via Cloudflare AI Gateway.

- Source: `src/lib/core/ai-gateway.service.ts`
- Config: bindings and secrets in `wrangler.jsonc`
- Contract: request(input) → response + usage metrics
- Usage: import and call from domain services; keep keys server-side
- Notes: validate env on startup; track usage; consistent error handling/monitoring

---

## Database (Hyperdrive + Postgres)

Mission: Pooled DB access patterns used by modules via core DB services.

- Core DB files: `src/lib/core/db/client.ts`, `src/lib/core/db/service.ts`, `src/lib/core/db/types.ts`
- Binding: Hyperdrive in `wrangler.jsonc` (no direct DB URLs in code)
- Contract: pooled connections and typed query helpers; base class for module services
- Patterns: extend base service; parameterized queries; typed results
- Notes: update types with schema changes; monitor query perf and indexes

---

## Platform Constraints

### WORKERS_SAFE_LIBS
Only use libraries compatible with Cloudflare Workers. Never use libraries with FFI/native/C bindings.

### ENVIRONMENT_SETUP
All secrets must be configured via `wrangler secret put`. Never hardcode secrets.

### DB_ACCESS_PATTERN
Use Hyperdrive binding through core DB service patterns. Never connect directly to database.

### AI_GATEWAY_PATTERN
All LLM calls must go through AI Gateway service. Never call LLM APIs directly.

## Cloudflare Workers

Mission: Centralize Workers/D1/KV/DO/Hyperdrive and security guidance for this project.

- Bindings & Config: defined in `wrangler.jsonc`; Hyperdrive for Postgres; AI Gateway; secrets with `wrangler secret put <NAME>`
- Best Practices: SSR-first; minimize cold starts; workers-safe libs; validate env early; use pooling
- Dev Tips: `npm run dev` uses remote resources; mock bindings in tests as needed
- Error Patterns: missing OPENROUTER_TOKEN; base URL mismatch; DB timeouts (tune Hyperdrive and queries)
- Security: never log secrets; sanitize LLM output; validate all inputs server-side

---

## Conventions

Mission: Keep code consistent and simple for a Workers-first SvelteKit app.

- Structure: SvelteKit defaults; routes co-locate UI + server; domain modules in `src/lib/modules/*`; shared infra in `src/lib/core/*`; one `types.ts` per module
- Naming & Style: camelCase; strict TS; minimal deps; no native/FFI; comment non-obvious logic
- Architecture: service layer owns business logic; prefer DB work over Worker compute; use SvelteKit builtins
- Security: server-only LLM calls; validate input at boundaries; prefer SSR and form actions

---

## Setup

Quick commands

```bash
npm ci
npm run dev
# build and preview
npm run build
npm run preview
# deploy
npx wrangler deploy
```

Notes

- Wrangler dev uses remote resources; ensure `wrangler login` and bindings are configured.
- Secrets with `wrangler secret put <NAME>`.

---

## Testing

See detailed guide: ./testing.md

Common commands

- `npm test` (all)
- `npm run test:unit`
- `npm run test:integration`
- `npm run test:unit -- --watch`
- `npm run test:unit -- --coverage`

Structure

- Unit: `src/**/*.test.ts`
- Integration: `tests/integration/`
- Fixtures: `tests/fixtures/`

Patterns

- Arrange, Act, Assert; mock external deps (DB, network); cover edge/error paths.

---

## Prompts

Locations

- PaceNote: `src/lib/modules/paceNote/prompts/`
- PolicyFoo handlers: each under its `prompts/`

Conventions

- Keep base templates in `base.md` where applicable.
- Favor small, composable prompts; version via comments/commits.
