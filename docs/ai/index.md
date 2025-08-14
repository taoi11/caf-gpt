# CAF GPT – Cloudflare Serverless Edition

> 🤖 AI Agent Navigation Guide — Project index for humans and LLM coding agents

Use this page to jump to focused docs. Each doc follows an agent-friendly structure (Mission, Context, Contracts, Constraints, Steps, Edge cases, Validation, Don’ts, Links).

## Documentation Map

### Core Infrastructure
- [Core Handbook](./core.md) - AI Gateway, DB patterns, Workers constraints
- [Testing Guide](./testing.md) - Commands, structure, patterns
- [Setup Guide](./core.md#setup) - Quick start commands and environment

### Domain Modules
- [Modules Handbook](./modules.md) - Complete reference for all domain modules
  - [PaceNote Module](./module.paceNote.md) - Performance feedback generation
  - [PolicyFoo Module](./module.policyFoo.md) - Policy Q&A system
    - [DOAD Handler](./module.policyFoo.doadFoo.md) - Three-stage DOAD policy workflow
    - [LEAVE Handler](./module.policyFoo.leaveFoo.md) - Two-stage Leave policy workflow

### Application Routes
- [Routes Handbook](./routes.md) - Complete reference for all application routes
  - [Pacenote Route](./routes.md#pacenote-route) - Form-based feedback UI
  - [Policy Route](./routes.md#policy-route) - Chat UI for policy queries

### Development Resources
- [AI Agent Guidelines](./index.md#ai-agent-guidelines-short) - Best practices for LLM collaboration
- [Common Error Patterns](./index.md#common-error-patterns) - Troubleshooting guide

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

## Modules Overview

For complete module documentation, see the [Modules Handbook](./modules.md).

### Key Modules
- **PaceNote**: Generate performance feedback notes based on observations and rank competencies
- **PolicyFoo**: Answer policy questions with authoritative citations from CAF documents

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

## 📎 AI Agent Guidelines

When working with this codebase:
- Always start at [docs/ai/index.md](./index.md) for documentation navigation
- Refer to specific module docs using the Documentation Map above
- When creating new documentation, follow the standard template structure
