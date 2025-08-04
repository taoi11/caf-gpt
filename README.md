# CAF GPT - Cloudflare Serverless Edition

> **🤖 AI Agent Navigation Guide** - Internal Developer/Agent Reference

AI-powered assistance tools for CAF troops with modular, maintainable architecture.

## Development

### Quick Commands

```bash
npm run lint          # Run prettier formatting and linting
npm run dev           # Build once, then start wrangler dev (recommended)
npm run dev:local     # Build once, then start wrangler dev locally
npm run dev:remote    # Build once, then start wrangler dev with remote resources
npm run build         # Build for production
npm run preview       # Build and preview locally
```

## Overview & Project Structure

**Domain Modules:**

- **PaceNote**: Generate performance feedback notes based on observations and rank competencies
- **PolicyFoo**: Answer policy questions with authoritative citations from CAF documents

**Architecture Principles:**

- **Co-located Components**: Route-specific UI components live with their routes
- **Domain Services**: Business logic organized by functional domain
- **Type-Safe**: End-to-end TypeScript with strict validation
- **Server-First**: Security and performance through server-side rendering
- **Local Storage**: Prompts and templates stored as static files for fast access

## Project Structure

```
src/
├── lib/
│   ├── server/
│   │   └── db/
│   └── modules/
│       ├── paceNote/
│       └── policyFoo/
└── routes/
  ├── pacenote/
  └── policy/
```

## Modules

### PaceNote Service

**Status**: ✅ Production Ready
**Route**: `/pacenote`
**Domain**: Performance Feedback
**Documentation**: `src/lib/modules/paceNote/README.md`
**Route Implementation**: `src/routes/pacenote/README.md`
**Key Dependencies**: AI Gateway
**Related Files**: `src/lib/modules/paceNote/` + `src/routes/pacenote/`

### PolicyFoo Service

**Status**: ✅ Production Ready
**Route**: `/policy`
**Domain**: Policy Q&A
**Documentation**: `src/lib/modules/policyFoo/README.md`
**Handlers**: `src/lib/modules/policyFoo/doadFoo/README.md` + `src/lib/modules/policyFoo/leaveFoo/README.md`
**Key Dependencies**: AI Gateway + Neon Postgres
**Related Files**: `src/lib/modules/policyFoo/` + `src/routes/policy/`

## Architecture

**Modern Serverless Stack:**

- **Frontend**: SvelteKit with TypeScript
- **Backend**: Cloudflare Workers
- **Databases**: Neon Postgres with Drizzle ORM for policy content storage
- **AI Integration**: AI Gateway with OpenRouter provider
- **Authentication**: Server-side only, no API keys required
- **Styling**: Tailwind CSS v4
- **Testing**: Vitest with multiple test environments

**Key Features:**

- **Security-First**: Server-side rendering with built-in CSRF protection
- **Type-Safe Database**: Drizzle ORM with TypeScript schema validation
- **Modern AI Integration**: Cloudflare AI Gateway with cost tracking and monitoring
- **Comprehensive Testing**: Unit, integration, and client-side test environments
- **Developer Experience**: Hot reloading, type generation, database migrations

## Configuration

### Cloudflare Bindings

Configure in `wrangler.jsonc`:

- **AI Gateway**: Configure with OpenRouter provider
- **Environment Variables**: Model selection and database URL

## Common Error Patterns

### Environment Configuration

- **Missing OPENROUTER_TOKEN**: Check `wrangler secret put OPENROUTER_TOKEN`
- **Database Connection**: Verify `DATABASE_URL` format for Neon Postgres
- **AI Gateway Issues**: Confirm `AI_GATEWAY_BASE_URL` and optional `CF_AIG_TOKEN`

### Module Integration

- **Import Errors**: Check co-located exports in `index.ts` files
- **Type Errors**: Verify module-level `types.ts` files are properly exported
- **Service Dependencies**: Ensure shared services (`ai-gateway.service.ts`) are imported correctly

### Database Issues

- **Connection Pooling**: See `src/lib/core/db/client.ts` for Neon configuration
- **Schema Changes**: Update `src/lib/core/db/schema.ts` with Drizzle ORM
- **Query Performance**: Check database service implementations for optimization patterns

## 📋 AI Agent Guidelines

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
