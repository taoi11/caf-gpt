# CAF GPT - Cloudflare Serverless Edition

> **🤖 AI Agent Navigation Guide** - Internal Developer/Agent Reference

AI-powered assistance tools for CAF troops with modular, maintainable architecture.

## 🚀 Quick Start for AI Agents

**For New Feature Development**: Start with [Project Structure](#project-structure) → Choose module type → Review [Development](#development)  
**For Bug Fixes**: Check [Common Error Patterns](#common-error-patterns) → Review specific module README  
**For Policy Updates**: See [PolicyFoo Service](#policyfoo-service) → [DOAD Handler](src/lib/modules/policyFoo/doadFoo/README.md)  
**For Performance Issues**: Review [Testing Strategy](tests/README.md) → Module-specific performance sections

## Development

### Quick Commands

```bash
npm run dev           # Build once, then start wrangler dev (recommended)
npm run dev:local     # Build once, then start wrangler dev locally
npm run dev:remote    # Build once, then start wrangler dev with remote resources
npm run build         # Build for production
npm run preview       # Build and preview locally
```

### Development Workflow

The development setup uses SvelteKit's built-in Cloudflare adapter integration:

1. **Build First**: `vite build` generates optimized Cloudflare Workers-compatible output
2. **Wrangler Dev**: `wrangler dev` serves the pre-built application with live bindings
3. **No Double Builds**: Build happens once upfront, eliminating rebuild loops

For rapid iteration during development:
- Use `npm run dev:build-only` to rebuild SvelteKit changes
- Use `npm run dev:wrangler-only` to restart just the Wrangler dev server

## Overview

**Domain Modules:**

- **PaceNote**: Generate performance feedback notes based on observations and rank competencies
- **PolicyFoo**: Answer policy questions with authoritative citations from CAF documents

**Architecture Principles:**

- **Co-located Components**: Route-specific UI components live with their routes
- **Domain Services**: Business logic organized by functional domain
- **Type-Safe**: End-to-end TypeScript with strict validation
- **Server-First**: Security and performance through server-side rendering
- **Database-Driven**: Postgres for structured data and D1 for lightweight storage

## Project Structure

```
src/
├── lib/
│   ├── server/
│   │   ├── ai-gateway.service.ts  # Shared AI Gateway service
│   │   ├── r2.util.ts             # R2 utility functions
│   │   └── db/                    # Database infrastructure
│   │       ├── client.ts          # Neon Postgres connection pooling
│   │       ├── schema.ts          # Drizzle ORM schema definitions
│   │       └── types.ts           # Database type definitions
│   └── modules/                   # Domain-specific business logic
│       ├── paceNote/              # PaceNote service module
│       │   ├── README.md          # PaceNote documentation
│       │   ├── service.ts         # Service implementation
│       │   ├── types.ts           # Type definitions
│       │   └── constants.ts       # Configuration
│       └── policyFoo/             # PolicyFoo service module
│           ├── README.md          # PolicyFoo documentation
│           ├── doadFoo/           # DOAD policy handler
│           │   ├── README.md      # DOAD-specific docs
│           │   └── *.ts           # Handler implementation
│           └── leaveFoo/          # Leave policy handler
└── routes/                        # SvelteKit routes
    ├── pacenote/                  # PaceNote UI and server logic
    │   ├── +page.svelte          # PaceNote interface
    │   ├── +page.server.ts       # Server-side logic
    │   └── *.svelte              # UI components
    └── policy/                    # PolicyFoo UI and server logic
        ├── +page.svelte          # Policy chat interface
        ├── +page.server.ts       # Server-side logic
        └── PolicyComponents/     # UI components
```

## Modules

### PaceNote Service

**Status**: ✅ Production Ready | **Route**: `/pacenote` | **Domain**: Performance Feedback  
**Documentation**: [PaceNote README](src/lib/modules/paceNote/README.md) | **Route Implementation**: [PaceNote Route](src/routes/pacenote/README.md)

Generate professional feedback notes based on CAF rank competencies (Cpl, MCpl, Sgt, WO).

**Key Dependencies**: AI Gateway, R2 Storage  
**Related Files**: `src/lib/modules/paceNote/` + `src/routes/pacenote/`

### PolicyFoo Service

**Status**: ✅ Production Ready | **Route**: `/policy` | **Domain**: Policy Q&A  
**Documentation**: [PolicyFoo README](src/lib/modules/policyFoo/README.md) | **Handlers**: [DOAD](src/lib/modules/policyFoo/doadFoo/README.md) | [LEAVE](src/lib/modules/policyFoo/leaveFoo/README.md)

AI-powered policy question answering with three-stage workflow (finder → metadata selector → main agent). Supports DOAD and LEAVE policies via Neon Postgres database.

**Key Dependencies**: AI Gateway, Neon Postgres, Advanced Multi-Agent Workflow  
**Related Files**: `src/lib/modules/policyFoo/` + `src/routes/policy/`

## Architecture

**Modern Serverless Stack:**

- **Frontend**: SvelteKit with TypeScript
- **Backend**: Cloudflare Workers
- **Databases**:
  - Drizzle ORM with Cloudflare D1 (SQLite) for application data
  - Neon Postgres with Drizzle ORM for policy content storage
- **AI Integration**: AI Gateway with OpenRouter provider
- **File Storage**: Cloudflare R2 Storage
- **Authentication**: Server-side only, no API keys required
- **Styling**: Tailwind CSS v4
- **Testing**: Vitest with multiple test environments

**Key Features:**

- **Security-First**: Server-side rendering with built-in CSRF protection
- **Type-Safe Database**: Drizzle ORM with TypeScript schema validation
- **Modern AI Integration**: Cloudflare AI Gateway with cost tracking and monitoring
- **Comprehensive Testing**: Unit, integration, and client-side test environments
- **Developer Experience**: Hot reloading, type generation, database migrations

## Project Structure

The source code is organized into server utilities (AI Gateway service, R2 utilities, database infrastructure), domain-specific business logic modules (PaceNote service for feedback generation, PolicyFoo service for policy Q&A), and SvelteKit routes (PaceNote UI and server logic, PolicyFoo UI and server logic).

## Configuration

### Required Environment Variables

Core functionality requires OpenRouter token for AI services, AI Gateway base URL for routing, and database URL for Postgres connection. Optional variables include enhanced monitoring token and model selection.

### Cloudflare Bindings

Configure in `wrangler.jsonc`:

- **R2 Bucket**: `POLICIES` (for document storage)
- **AI Gateway**: Configure with OpenRouter provider
- **Environment Variables**: Model selection and database URL

## Development

### Available Scripts

Commands are available for development and build (local development with hot reload, build for production, preview build), quality and formatting (TypeScript and Svelte checks, code formatting, linting), testing (run all tests, unit tests, integration tests, coverage), and deployment (deploy to Cloudflare, generate types).

### Quick Start

1. Install dependencies: `npm install`
2. Configure secrets: `wrangler secret put OPENROUTER_TOKEN`
3. Start development: `npm run dev`
4. Deploy: `npm run deploy`

## Common Error Patterns

### Environment Configuration

- **Missing OPENROUTER_TOKEN**: Check `wrangler secret put OPENROUTER_TOKEN`
- **Database Connection**: Verify `DATABASE_URL` format for Neon Postgres
- **AI Gateway Issues**: Confirm `AI_GATEWAY_BASE_URL` and optional `CF_AIG_TOKEN`

### Module Integration

- **Import Errors**: Check co-located exports in `index.ts` files
- **Type Errors**: Verify module-level `types.ts` files are properly exported
- **Service Dependencies**: Ensure shared services (`ai-gateway.service.ts`, `r2.util.ts`) are imported correctly

### Database Issues

- **Connection Pooling**: See `src/lib/server/db/client.ts` for Neon configuration
- **Schema Changes**: Update `src/lib/server/db/schema.ts` with Drizzle ORM
- **Query Performance**: Check database service implementations for optimization patterns

## 📋 AI Agent Reference

### File Organization Patterns

- **Services**: Each domain has a main service file containing the core business logic
- **Types**: Each module has one types file with all TypeScript definitions
- **Routes**: Each domain has its own UI directory with co-located components
- **Shared**: Common utilities used across multiple domains

### Common Tasks

- **Add New Module**: Use existing modules as templates for structure and patterns
- **Add Route**: Create new domain directory with standard SvelteKit structure
- **Database Operations**: Extend database schema and related service files
- **AI Integration**: Use shared AI Gateway service for LLM functionality

### Testing Approach

- **Unit Tests**: Tests live next to the code they test
- **Integration**: Cross-module testing in dedicated test directory
- **Coverage**: Comprehensive reporting available for quality assurance
