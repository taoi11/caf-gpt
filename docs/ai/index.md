# CAF GPT – Cloudflare Serverless Edition

> 🤖 AI Agent Navigation Guide — Project index for humans and LLM coding agents

Use this page to jump to focused docs. Each doc follows an agent-friendly structure (Mission, Context, Contracts, Constraints, Steps, Edge cases, Validation, Don’ts, Links).

## Quick Links

- Setup: ./core.md
- Testing: ./testing.md
- Core Handbook (AI, DB, Workers, Conventions): ./core.md
- Modules handbook: ./modules.md
- Routes handbook: ./routes.md
- PaceNote module: ./module.paceNote.md
- PolicyFoo module: ./module.policyFoo.md (with ./module.policyFoo.doadFoo.md and ./module.policyFoo.leaveFoo.md)

## Development — Quick Commands

```bash
npm run lint          # Prettier + lint
npm run dev           # Build once, start wrangler dev with remote resources
npm run build         # Production build
npm run preview       # Build and preview locally
```

## Overview & Project Structure

Domain Modules:

- PaceNote: Generate performance feedback notes based on observations and rank competencies
- PolicyFoo: Answer policy questions with authoritative citations from CAF documents

Architecture Principles:

- Co-located components and docs
- Domain services (business logic by functional domain)
- Type-safe end-to-end TypeScript
- Server-first rendering for security/perf
- Prompts stored as static files

Project Structure

```
src/
├── lib/
│   ├── core/
│   │   └── db/
│   └── modules/
│       ├── paceNote/
│       └── policyFoo/
└── routes/
    ├── pacenote/
    └── policy/
```

See: ./modules.md and ./routes.md

## Modules (jump-start)

### PaceNote Service

- Status: ✅ Production Ready
- Route: /pacenote
- Domain: Performance Feedback
- Docs: ./module.paceNote.md
- Route Docs: ./routes.md#pacenote-route

### PolicyFoo Service

- Status: ✅ Production Ready
- Route: /policy
- Domain: Policy Q&A
- Docs: ./module.policyFoo.md
- Handler Docs: ./module.policyFoo.doadFoo.md, ./module.policyFoo.leaveFoo.md
- Route Docs: ./routes.md#policy-route

## Architecture

Modern Serverless Stack:

- Frontend: SvelteKit + TypeScript
- Backend: Cloudflare Workers
- Database: Postgres via Cloudflare Hyperdrive (node-postgres)
- AI Integration: Cloudflare AI Gateway with OpenRouter
- Styling: Tailwind CSS v4
- Testing: Vitest (multi env)

Key features:

- Security-first SSR
- Type-safe DB access patterns
- AI Gateway monitoring
- Comprehensive testing

## Configuration (bindings overview)

Defined in wrangler.jsonc:

- AI Gateway (OpenRouter provider)
- Hyperdrive (Postgres pooling)
- Env vars for model selection and secrets

Details: ./core.md

## Common Error Patterns

Environment

- Missing OPENROUTER_TOKEN → use wrangler secret put OPENROUTER_TOKEN
- Hyperdrive configured as binding, not direct DB string
- AI Gateway base URL/token mismatches

Integration

- Import errors → check index.ts co-located exports
- Type errors → verify module types.ts are exported
- Shared service imports → $lib/core/ai-gateway.service

Database

- Pooling via Hyperdrive
- Schema edits → update $lib/core/db/types.ts and services
- Query perf → follow $lib/core/db/service.ts patterns

## 📎 AI Agent Guidelines (short)

File organization

- Services per domain; shared infra in $lib/core
- One types.ts per module
- Routes co-locate UI + server logic

Common tasks

- New module → copy structure from PaceNote/PolicyFoo
- New route → standard SvelteKit structure
- DB ops → core/db service patterns
- LLM → AI Gateway service

Testing approach: see ./testing.md
