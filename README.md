# CAF GPT - Cloudflare Serverless Edition

An AI-powered application built with SvelteKit and deployed on Cloudflare's serverless platform.

## Overview

CAF GPT provides AI-powered assistance tools for CAF troops with a focus on modular, maintainable architecture:

- **PaceNote**: ✅ **Fully Functional** - Generate feedback notes for lazy CAF members based on observations and rank-specific competencies. Features a complete co-located module with form handling, results display, and route-specific utilities.
- **PolicyFoo**: ✅ **Fully Functional** - AI-powered policy question answering with authoritative citations. Features two-stage agent workflow (finder → main) with support for DOAD policies and extensible architecture for additional policy sets.

**Architecture Highlights:**
- **Co-located Components**: Route-specific UI components live with their routes
- **Domain Services**: Business logic organized by functional domain
- **Type-Safe**: End-to-end TypeScript with strict validation
- **Server-First**: Security and performance through server-side rendering

## Service Modules

### PaceNote Service
**Status**: ✅ Production Ready  
**Route**: `/pacenote`  
**Purpose**: Generate performance feedback notes based on observations and CAF rank competencies

**Features:**
- Rank-specific competency mapping (Cpl, MCpl, Sgt, WO)
- Intelligent feedback generation with AI
- Form validation and error handling
- Usage tracking and cost monitoring

### PolicyFoo Service  
**Status**: ✅ Production Ready  
**Route**: `/policy`  
**Documentation**: 
- [Main Documentation](src/lib/services/policyFoo/README.md)
- [DOAD Handler Documentation](src/lib/services/policyFoo/doadFoo/README.md)

**Purpose**: Answer policy questions with authoritative citations from CAF policy documents

**Features:**
- **Two-Stage AI Workflow**: Finder agent identifies relevant policies, main agent synthesizes responses
- **Multi-Model Strategy**: Optimized model selection (lightweight for identification, powerful for synthesis)
- **Policy Set Support**: DOAD policies implemented, extensible for additional policy types
- **Stateless Architecture**: Client-side conversation management, serverless-optimized
- **Interactive Citations**: Clickable policy references with external links
- **XML Response Parsing**: Structured responses with answers, citations, and follow-up questions
- **Progressive Enhancement**: Works with and without JavaScript
- **Error Resilience**: Graceful handling of missing policies and service failures

**Supported Policy Sets:**
- ✅ **DOAD** (Defence Operations and Activities Directives) - Fully implemented
- 📋 **LEAVE** (Leave Policies) - Planned for future implementation

**Architecture:**
- **Backend**: Stateless request processing with raw XML responses
- **Frontend**: Smart client-side parsing and conversation management
- **Storage**: Policy documents stored in Cloudflare R2 bucket
- **AI Models**: Dual-model approach for cost and performance optimization

## Architecture

**Modern Serverless Stack:**
- **Frontend**: SvelteKit with TypeScript
- **Backend**: Cloudflare Workers  
- **Database**: Drizzle ORM with Cloudflare D1 (SQLite)
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

## Technology Stack

- **Runtime**: Cloudflare Workers
- **Framework**: SvelteKit v2 with SSR/SSG
- **Language**: TypeScript with strict typing
- **Database**: Drizzle ORM + Cloudflare D1 (SQLite)
- **AI Provider**: AI Gateway → OpenRouter
- **Storage**: Cloudflare R2 with libSQL client
- **Testing**: Vitest with jsdom and testing-library
- **Styling**: Tailwind CSS v4 with Vite plugin
- **Development**: Wrangler CLI with type generation

## Project Structure

```
src/
├── lib/
│   └── services/           # Domain-specific business logic
│       ├── paceNote/       # PaceNote service module
│       │   ├── README.md   # PaceNote documentation
│       │   ├── *.ts        # Service implementation
│       │   └── __tests__/  # Unit tests
│       └── policyFoo/      # PolicyFoo service module
│           ├── README.md   # Main PolicyFoo documentation
│           ├── *.ts        # Core service files
│           ├── doadFoo/    # DOAD policy handler
│           │   ├── README.md      # DOAD-specific docs
│           │   ├── *.ts           # Handler implementation
│           │   └── prompts/       # LLM prompts
│           └── leaveFoo/   # Future: Leave policy handler
└── routes/                 # SvelteKit routes
    ├── pacenote/          # PaceNote UI and server logic
    │   ├── +page.svelte   # PaceNote interface
    │   ├── +page.server.ts # Server-side logic
    │   └── *.svelte       # UI components
    └── policy/            # PolicyFoo UI and server logic
        ├── +page.svelte   # Policy chat interface
        ├── +page.server.ts # Server-side logic
        └── PolicyComponents/ # Reusable UI components
```

**Architecture Principles:**
- **Co-location**: Related functionality grouped together
- **Domain Services**: Business logic separate from UI
- **Route-Specific Components**: UI components live with their routes
- **Independent Modules**: Services can be developed and tested independently

## Quick Start

### Prerequisites
- Node.js 18+ 
- Cloudflare account with AI Gateway enabled
- OpenRouter account and API key
- Wrangler CLI installed 

### Configuration

The application runs entirely server-side for security.

**Required Cloudflare Secrets:**
```bash
wrangler secret put OPENROUTER_TOKEN
wrangler secret put AI_GATEWAY_BASE_URL
```

**Note**: No API key authentication needed - the application is secured by running server-side only.

### Required Cloudflare Bindings

Configure in your Cloudflare dashboard or `wrangler.jsonc`:

- **R2 Bucket**: `POLICIES` (for PolicyFoo document storage)  
- **Environment Variables**:
    - `FN_MODEL` - AI model to use (configured in wrangler.jsonc)
    - `READER_MODEL` - Optional: PolicyFoo finder agent model (default: claude-3-haiku)
    - `MAIN_MODEL` - Optional: PolicyFoo main agent model (default: claude-3-5-sonnet)
- **Secrets**: 
    - `OPENROUTER_TOKEN` - OpenRouter API key for AI Gateway
    - `AI_GATEWAY_BASE_URL` - AI Gateway endpoint URL
    - `CF_AIG_TOKEN` - Optional: Enhanced AI Gateway monitoring

> **Note**: All secrets should be configured via `wrangler secret put` for production deployment.

**R2 Bucket Structure for PolicyFoo:**
```
policies/                    # R2 bucket name
├── doad/                   # DOAD policies
│   ├── 1000-1.md          # Individual policy files
│   ├── 5017-1.md          # Leave policies  
│   └── ...                # Additional DOAD policies
└── leave/                 # Future: Leave policies
    └── ...                # Leave policy files
```

### AI Gateway Setup

The application uses Cloudflare AI Gateway with OpenRouter:

1. **Create AI Gateway** in your Cloudflare dashboard
2. **Configure OpenRouter** provider with your API key
3. **Set Gateway URL** as `AI_GATEWAY_BASE_URL` secret
4. **Model Selection** via `FN_MODEL` environment variable

This setup provides:
- ✅ Cost tracking and budgets
- ✅ Request caching and rate limiting  
- ✅ Analytics and monitoring
- ✅ Fallback and retry logic

## Deployment

### Production Deployment

1. **Build and deploy:**
   ```bash
   npm run deploy
   ```

2. **Database setup (if using D1):**
   ```bash
   # Apply migrations to production database
   npm run db:migrate
   
   # Or push schema directly
   npm run db:push
   ```

3. **Verify deployment:**
   ```bash
   # Check health endpoint
   curl https://your-app.workers.dev/api/health
   ```

### Environment Configuration

**Required Secrets:**
```bash
# Core functionality
wrangler secret put OPENROUTER_TOKEN       # OpenRouter API key
wrangler secret put AI_GATEWAY_BASE_URL    # AI Gateway endpoint

# Optional enhancements
wrangler secret put CF_AIG_TOKEN          # Enhanced AI Gateway monitoring
wrangler secret put DATABASE_URL          # External database (if not using D1)
```

**Wrangler Configuration:**
```jsonc
{
  "name": "caf-gpt",
  "compatibility_date": "2025-05-23",
  "compatibility_flags": ["nodejs_compat"],
  "ai": { "binding": "AI" },
  "r2_buckets": [
    {
      "binding": "POLICIES",
      "bucket_name": "policies",
      "preview_bucket_name": "policies"
    }
  ],
  "vars": {
    "FN_MODEL": "openai/gpt-4.1-mini"
  },
  "observability": { "enabled": true },
  "placement": { "mode": "smart" }
}
```

## Troubleshooting

### Common Issues

**Database Connection:**
```bash
# Regenerate types if bindings change
npm run cf-typegen

# Check D1 database status
wrangler d1 list

# Test database connectivity
wrangler d1 execute your-db --command="SELECT 1"
```

**AI Gateway Issues:**
```bash
# Verify AI Gateway configuration
curl -H "Authorization: Bearer $OPENROUTER_TOKEN" \
     $AI_GATEWAY_BASE_URL/v1/models

# Check gateway logs in Cloudflare dashboard
# Navigate to AI Gateway > Analytics
```

**Development Environment:**
```bash
# Clear Wrangler cache
rm -rf .wrangler

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Reset local development
npm run dev:local
```

### Performance Optimization

**Caching Strategy:**
- **Static Assets**: Cached at edge via Cloudflare CDN
- **AI Responses**: Cached via AI Gateway (configurable TTL)
- **Database Queries**: Consider caching frequent lookups
- **R2 Objects**: Use appropriate cache headers

**Bundle Size:**
```bash
# Analyze bundle size
npm run build
npx vite-bundle-analyzer dist

# Check Worker size limits
wrangler deploy --dry-run
```

## Development Workflow

### Available Scripts

```bash
# Development
npm run dev              # Local development with hot reload
npm run dev:local        # Development with local bindings
npm run dev:remote       # Development with remote Cloudflare resources

# Building & Deployment
npm run build            # Build for production
npm run preview          # Preview production build locally
npm run deploy           # Build and deploy to Cloudflare

# Database Management
npm run db:push          # Push schema changes to database
npm run db:migrate       # Run database migrations
npm run db:studio        # Open Drizzle Studio (database GUI)

# Testing
npm run test             # Run all tests
npm run test:client      # Run client-side tests
npm run test:server      # Run server-side tests
npm run test:integration # Run integration tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run tests with coverage report

# Code Quality
npm run lint             # Run ESLint
npm run format           # Run Prettier
npm run check            # TypeScript and Svelte checks
npm run cf-typegen       # Generate Cloudflare Worker types
```

### Architecture Benefits

**Security-First Design:**
- **Server-Side Rendering**: All sensitive operations happen server-side
- **No API Key Exposure**: Client never handles API keys or secrets
- **Built-in CSRF Protection**: SvelteKit handles security automatically
- **Type Safety**: End-to-end TypeScript validation

**Performance Optimized:**
- **Edge Computing**: Runs on Cloudflare's global network
- **Smart Placement**: Automatically routes to optimal data centers
- **Caching**: Built-in request and response caching
- **Progressive Enhancement**: Works without JavaScript

**Developer Experience:**
- **Hot Module Replacement**: Instant feedback during development
- **Type Generation**: Automatic types from Cloudflare bindings
- **Database Introspection**: Drizzle generates types from schema
- **Comprehensive Testing**: Multiple test environments and utilities

## Available Endpoints

### Health Check
```bash
GET /api/health
# Returns: Service status and binding availability
```

**Note**: The PaceNote functionality is integrated into the web interface at `/pacenote` using SvelteKit server actions, providing better security and user experience than traditional API endpoints.

## Project Structure

```
├── drizzle.config.ts           # Drizzle ORM configuration
├── wrangler.jsonc              # Cloudflare Workers configuration
├── package.json                # Dependencies and scripts
├── tsconfig.json               # TypeScript configuration
├── vite.config.ts              # Vite build configuration
├── svelte.config.js            # SvelteKit configuration
├── vitest-setup-client.ts      # Test environment setup
├── paceNote/                   # External policy documents
├── src/
│   ├── app.html                # HTML template
│   ├── app.css                 # Global styles (Tailwind)
│   ├── worker-configuration.d.ts # Cloudflare bindings types
│   ├── lib/
│   │   ├── index.ts            # Shared utilities
│   │   └── services/
│   │       └── paceNote/       # PaceNote service module
│   │           ├── service.ts          # Main service logic
│   │           ├── ai-gateway.service.ts # AI Gateway integration
│   │           ├── workers-ai.service.ts # Legacy Workers AI
│   │           ├── types.ts            # TypeScript types
│   │           ├── constants.ts        # Configuration constants
│   │           ├── r2.util.ts          # R2 storage utilities
│   │           ├── index.ts            # Module exports
│   │           ├── __tests__/          # Unit tests
│   │           └── prompts/
│   │               └── base.md         # AI prompt templates
│   └── routes/
│       ├── +layout.svelte      # App layout
│       ├── +page.svelte        # Landing page
│       ├── pacenote/           # 🔥 Co-located PaceNote feature
│       │   ├── +page.server.ts        # Server-side logic
│       │   ├── +page.svelte           # Main page component
│       │   ├── PaceNoteForm.svelte    # Form component
│       │   ├── PaceNoteResults.svelte # Results display component
│       │   ├── PaceNoteTips.svelte    # Usage tips component
│       │   └── ui.ts                  # Route-specific utilities
│       ├── policy/
│       │   └── +page.svelte    # Policy Q&A (coming soon)
│       ├── api/
│       │   └── health/
│       │       └── +server.ts  # Health check endpoint
│       └── __tests__/          # Route tests
├── static/                     # Static assets
├── tests/
│   ├── e2e/                    # End-to-end tests
│   ├── integration/            # Integration tests
│   └── fixtures/               # Test fixtures
```

### Architecture Philosophy

**Co-location Principle:**
- **Route-Specific Components**: UI components live with their routes (`/pacenote/*`)
- **Domain Services**: Business logic grouped by domain (`/services/paceNote/`)
- **Shared Utilities**: Only truly reusable code lives in `/lib/common/`

**Modular Design:**
- **Single Responsibility**: Each component and service has one clear purpose
- **Minimal Dependencies**: Components only import what they need
- **Clear Boundaries**: Separation between UI logic and business logic

### Key Components

**Modular Services Layer:**
- **PaceNote Service**: Complete domain module with business logic, types, and utilities
- **AI Gateway Service**: Handles AI provider communication and monitoring
- **R2 Utilities**: File storage and retrieval operations
- **Rate Limiting**: Request throttling and quota management

**Co-located Route Components:**
- **PaceNote Route**: Self-contained feature with all UI components and utilities
  - `+page.server.ts`: Server-side logic and form actions
  - `+page.svelte`: Main page orchestration
  - `PaceNoteForm.svelte`: Form input and validation
  - `PaceNoteResults.svelte`: Results display and interaction
  - `PaceNoteTips.svelte`: Static usage guidance
  - `ui.ts`: Route-specific utilities (scroll, clipboard, etc.)

**SvelteKit Architecture:**
- **Server Actions**: Form handling with automatic CSRF protection
- **Load Functions**: Server-side data fetching and configuration
- **Progressive Enhancement**: JavaScript-optional functionality
- **Type Safety**: End-to-end TypeScript validation
