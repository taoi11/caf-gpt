# CAF GPT - Cloudflare Serverless Edition

> **Internal Developer/Agent Reference** - Not a public getting started guide

AI-powered assistance tools for CAF troops with modular, maintainable architecture.

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

## Modules

### PaceNote Service

**Status**: ✅ Production Ready | **Route**: `/pacenote`  
**Documentation**: [PaceNote README](src/lib/modules/paceNote/README.md)

Generate professional feedback notes based on CAF rank competencies (Cpl, MCpl, Sgt, WO).

### PolicyFoo Service

**Status**: ✅ Production Ready | **Route**: `/policy`  
**Documentation**: [PolicyFoo README](src/lib/modules/policyFoo/README.md) | [DOAD Handler](src/lib/modules/policyFoo/doadFoo/README.md)

AI-powered policy question answering with three-stage workflow (finder → metadata selector → main agent). Supports DOAD policies via Neon Postgres database.

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

## Configuration

### Required Environment Variables

```bash
# Core functionality
OPENROUTER_TOKEN=your_openrouter_token
AI_GATEWAY_BASE_URL=your_ai_gateway_url
DATABASE_URL=your_postgres_connection_string

# Optional
CF_AIG_TOKEN=enhanced_monitoring_token
FN_MODEL=openai/gpt-4o-mini
```

### Cloudflare Bindings

Configure in `wrangler.jsonc`:

- **R2 Bucket**: `POLICIES` (for document storage)
- **AI Gateway**: Configure with OpenRouter provider
- **Environment Variables**: Model selection and database URL

## Development

### Available Scripts

```bash
# Development & Build
npm run dev              # Local development with hot reload
npm run dev:local        # Local development (explicit)
npm run dev:remote       # Remote development
npm run build            # Build for production
npm run preview          # Preview build locally

# Quality & Formatting
npm run check            # TypeScript and Svelte checks
npm run check:watch      # Watch mode for checks
npm run format           # Format code with Prettier
npm run lint             # Lint and format code
npm run prepare          # Prepare environment (typegen + sync)

# Testing
npm run test             # Run all tests
npm run test:unit        # Run unit tests only
npm run test:client      # Run client-side tests
npm run test:server      # Run server-side tests
npm run test:integration # Run integration tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run tests with coverage

# Deployment
npm run deploy           # Deploy to Cloudflare
npm run deploy:versions  # Upload deployment versions
npm run cf-typegen       # Generate Cloudflare types
```

### Quick Start

1. Install dependencies: `npm install`
2. Configure secrets: `wrangler secret put OPENROUTER_TOKEN`
3. Start development: `npm run dev`
4. Deploy: `npm run deploy`
