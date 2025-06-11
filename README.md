# CAF GPT - Cloudflare Serverless Edition

An AI-powered application suite built with SvelteKit and deployed on Cloudflare's serverless platform. This is a complete rewrite of the original Django-based CAF GPT project, modernized for serverless architecture with improved performance, scalability, and cost-effectiveness.

## Overview

CAF GPT provides AI-powered assistance tools for CAF troops:
- **PaceNote**: Generate professional feedback notes for CAF members based on observations and rank-specific competencies
- **Policy Q&A**: Document-based question answering with citations *(coming soon)*

### Migration from Django

This project migrates from the original Django-based architecture to a modern serverless stack, maintaining all core functionality while improving:
- **Performance**: Edge computing with Cloudflare Workers
- **Scalability**: Serverless auto-scaling
- **Cost**: Pay-per-use pricing model
- **Developer Experience**: TypeScript and modern tooling

## Architecture

**Modern Serverless Stack:**
- **Frontend**: SvelteKit with TypeScript
- **Backend**: Cloudflare Workers/Pages  
- **Database**: Turso (LibSQL) with Drizzle ORM
- **Styling**: Tailwind CSS
- **AI Integration**: OpenRouter API
- **File Storage**: Cloudflare R2 Storage
- **Authentication**: Cloudflare Access

**Migrated from Django Stack:**
- **Frontend**: Django Templates → SvelteKit
- **Backend**: Django/Python → Cloudflare Workers/TypeScript  
- **Database**: PostgreSQL → Turso (LibSQL)
- **Storage**: AWS S3 → Cloudflare R2
- **Deployment**: Traditional hosting → Serverless edge

## Key Features

### Core Services

- **Workers AI Integration**: Multi-model LLM access using Cloudflare's AI platform
- **R2 Storage**: Document and template storage
- **Health Monitoring**: System status and connectivity checks

### PaceNote Module

- **AI-Powered Generation**: Generate professional pace notes using Cloudflare Workers AI
- **Rank-Specific Templates**: Customized feedback based on CAF rank levels (Cpl, MCpl, Sgt, WO)
- **Competency Integration**: Leverage rank-specific competency frameworks
- **Structured Output**: Two-paragraph format with events description and outcomes
- **Interactive Interface**: Real-time generation with copy-to-clipboard functionality

### Policy Module *(Coming Soon)*
- Document upload and indexing
- Intelligent document search  
- Q&A with source citations
- Multi-document querying

## Technology Stack

- **Runtime**: Cloudflare Workers
- **Framework**: SvelteKit  
- **Language**: TypeScript
- **Database**: Turso (LibSQL)
- **ORM**: Drizzle
- **Storage**: Cloudflare R2
- **Styling**: Tailwind CSS
- **AI Provider**: OpenRouter

## Development Setup

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Initialize database
npm run db:generate
npm run db:migrate

# Start development server
npm run dev

# Run tests
npm run test
```

## Environment Variables

```env
# Database (Turso)
DATABASE_URL=your_turso_database_url
DATABASE_AUTH_TOKEN=your_turso_auth_token

# Cloudflare R2 Storage
R2_ACCOUNT_ID=your_r2_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET_NAME=your_bucket_name

# Application Configuration
APP_SECRET_KEY=your_secret_key
RATE_LIMIT_HOURLY=10
RATE_LIMIT_DAILY=50
AI_MODEL=@cf/meta/llama-3.1-8b-instruct
```

## Deployment

This application is designed to deploy seamlessly on Cloudflare Pages with Workers integration.

```bash
# Build for production
npm run build

# Deploy to Cloudflare Pages
npm run deploy
```

## API Endpoints

### Core Services

- `GET /api/health` - System health check and status
- `GET /api/rate-limits` - Current rate limit status

### PaceNote Module

- `POST /api/pacenote/generate` - Generate pace note from user input
- `GET /api/pacenote/rate-limits` - PaceNote-specific rate limits

### Policy Module *(Coming Soon)*

- `POST /api/policy/upload` - Upload policy document
- `POST /api/policy/query` - Query documents  
- `GET /api/policy/documents` - List uploaded documents

## Project Structure

```
src/
├── lib/
│   ├── server/
│   │   ├── db/           # Database schemas and connections
│   │   ├── services/     # Core business logic services
│   │   ├── middleware/   # Request/response middleware
│   │   └── config/       # Configuration management
│   └── components/       # Reusable Svelte components
├── routes/
│   ├── +page.svelte      # Landing page
│   └── api/              # API endpoints
│       ├── health/       # Health check endpoints
│       └── pacenote/     # PaceNote API routes
└── workers/              # Cloudflare Workers
    ├── shared/           # Shared worker utilities
    └── pacenote/         # PaceNote-specific workers
```

## Migration Status

This is an active migration from the original Django-based CAF GPT. Current status:

✅ **Completed:**
- Project structure and tooling setup
- Database configuration (Turso + Drizzle)

🔄 **In Progress:**
- Core services (rate limiting, cost tracking)
- PaceNote functionality migration

⏳ **Planned:**
- Frontend UI components
- API endpoint implementation
- Deployment configuration

See `.ai/notepad/migration-checklist.md` for detailed progress tracking.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm run test`
5. Submit a pull request

## License

This project is licensed under the AGPL-3.0 License.

## Migration Notes

This project is a complete rewrite of the original Django-based CAF GPT application, migrated to a modern serverless architecture for improved performance, scalability, and cost-effectiveness.

**Key improvements:**
- **Performance**: Edge computing with sub-100ms response times
- **Scalability**: Auto-scaling serverless functions
- **Cost**: Pay-per-request pricing model
- **Developer Experience**: TypeScript, modern tooling, and better testing
- **Deployment**: Zero-downtime deployments via Cloudflare Pages
