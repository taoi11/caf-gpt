# CAF GPT - Cloudflare Serverless Edition

An AI-powered application built with SvelteKit and deployed on Cloudflare's serverless platform.

## Overview

CAF GPT provides AI-powered assistance tools for CAF troops:
- **PaceNote**: ✅ **Fully Functional** - Generate feedback notes for lazy CAF members based on observations and rank-specific competencies.
- **Policy Q&A**: Document-based question answering with citations *(coming soon)*.

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

- **R2 Bucket**: `POLICIES` (for document storage)  
- **Environment Variables**:
    - `FN_MODEL` - AI model to use (configured in wrangler.jsonc)
- **Secrets**: 
    - `OPENROUTER_TOKEN` - OpenRouter API key for AI Gateway
    - `AI_GATEWAY_BASE_URL` - AI Gateway endpoint URL

> **Note**: All secrets should be configured via `wrangler secret put` for production deployment.

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
│       ├── pacenote/
│       │   ├── +page.server.ts # Server-side logic
│       │   └── +page.svelte    # PaceNote interface
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

### Key Components

**Services Layer:**
- **PaceNote Service**: Co-located business logic, types, and utilities
- **AI Gateway Service**: Handles AI provider communication and monitoring
- **R2 Utilities**: File storage and retrieval operations

**SvelteKit Architecture:**
- **Server Actions**: Form handling with automatic CSRF protection
- **Load Functions**: Server-side data fetching
- **Progressive Enhancement**: JavaScript-optional functionality
