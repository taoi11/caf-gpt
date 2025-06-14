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
- **AI Integration**: Cloudflare Workers AI
- **File Storage**: Cloudflare R2 Storage
- **Authentication**: API Key-based with rate limiting
- **Styling**: Tailwind CSS

**Migrated from Django Stack:**
- **Frontend**: Django Templates → SvelteKit
- **Backend**: Django/Python → Cloudflare Workers/TypeScript  
- **AI Provider**: OpenRouter → Cloudflare Workers AI
- **Storage**: AWS S3 → Cloudflare R2
- **Deployment**: Traditional hosting → Serverless edge

## Technology Stack

- **Runtime**: Cloudflare Workers
- **Framework**: SvelteKit  
- **Language**: TypeScript
- **AI Provider**: Cloudflare Workers AI (Llama 3.1 8B Instruct)
- **Storage**: Cloudflare R2
- **Authentication**: API Key with rate limiting
- **Styling**: Tailwind CSS

## Quick Start

### Prerequisites
- Node.js 18+ 
- Cloudflare account with Workers AI enabled
- Wrangler CLI installed 

### API Configuration

The application uses API key authentication for secure access. 

**For Production (Recommended):**
Use Cloudflare secrets for secure key management:
```bash
wrangler secret put API_KEY
```

### Required Cloudflare Bindings

Configure these bindings in your Cloudflare dashboard or `wrangler.jsonc`:

- **AI Binding**: `AI` (Cloudflare Workers AI)
- **R2 Bucket**: `POLICIES` (for document storage)  
- **Secret**: `API_KEY` ✅ **Already configured** via `wrangler secret put API_KEY`

> **Note**: The API_KEY secret is already configured for production deployment. No additional environment variable setup required.

## API Reference

### Authentication

All API endpoints (except health check) require authentication via Bearer token:

```bash
curl -H "Authorization: Bearer your-api-key" \
     -H "Content-Type: application/json" \
     https://your-app.pages.dev/api/pacenote
```

### Endpoints

#### Health Check
```bash
GET /api/health
# Returns: Service status and binding availability
```

#### PaceNote Generation
```bash
POST /api/pacenote
Content-Type: application/json
Authorization: Bearer your-api-key

{
  "rank": "Cpl",
  "observations": "Member demonstrated exceptional leadership...",
  "competencyFocus": ["Leadership", "Technical Competence"] // optional
}

# Returns: Generated pace note with usage metrics
```

#### PaceNote Configuration
```bash
GET /api/pacenote
Authorization: Bearer your-api-key

# Returns: Available ranks, limits, and configuration
```

### Rate Limiting

- **10 requests per minute per IP**
- **Rate limit headers** included in responses
- **429 status code** when limit exceeded

## Project Structure

```
src/
├── lib/
│   ├── server/
│   │   └── auth.ts          # API authentication and rate limiting
│   ├── services/
│   │   └── paceNote/        # PaceNote service module
│   │       ├── service.ts   # Main PaceNote service
│   │       ├── workers-ai.service.ts  # AI integration
│   │       ├── types.ts     # Type definitions
│   │       ├── constants.ts # Configuration constants
│   │       └── prompts/     # AI prompt templates
│   └── types/
│       └── api.ts           # API contract types
├── routes/
│   ├── +page.svelte         # Landing page
│   ├── pacenote/
│   │   └── +page.svelte     # PaceNote generator interface
│   └── api/                 # API endpoints
│       ├── health/          # Health check endpoint
│       └── pacenote/        # PaceNote API routes
└── worker-configuration.d.ts # Cloudflare Workers type definitions
```
