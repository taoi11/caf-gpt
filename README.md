# CAF GPT - Cloudflare Serverless Edition

An AI-powered application suite built with SvelteKit and deployed on Cloudflare's serverless platform. This is a complete rewrite of the original Django-based CAF GPT project, modernized for serverless architecture.

## Overview

CAF GPT provides two main AI-powered services:
- **PaceNote**: Intelligent feedback note generation system
- **Policy Q&A**: Document-based question answering with citations

## Architecture

- **Frontend**: SvelteKit with TypeScript
- **Backend**: Cloudflare Workers/Pages
- **Database**: Turso (LibSQL) with Drizzle ORM
- **Styling**: Tailwind CSS
- **AI Integration**: OpenRouter API
- **File Storage**: Cloudflare R2 Storage
- **Authentication**: Cloudflare Access

## Key Features

### Core Services
- Rate limiting and cost tracking
- File upload and processing
- Session management
- User authentication

### PaceNote Module
- AI-powered feedback generation
- Chat session management
- Prompt template system
- Response history tracking

### Policy Module
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

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

## Environment Variables

```env
# Database
DATABASE_URL=your_turso_database_url
DATABASE_AUTH_TOKEN=your_turso_auth_token

# OpenRouter API
OPENROUTER_API_KEY=your_openrouter_api_key

# Cloudflare R2
R2_ACCOUNT_ID=your_r2_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET_NAME=your_bucket_name

# Application
APP_SECRET_KEY=your_secret_key
RATE_LIMIT_REQUESTS_PER_MINUTE=60
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

### Core
- `GET /api/health` - Health check
- `POST /api/auth/login` - User authentication

### PaceNote
- `POST /api/pacenote/chat` - Create chat session
- `GET /api/pacenote/sessions` - List user sessions
- `POST /api/pacenote/generate` - Generate feedback note

### Policy
- `POST /api/policy/upload` - Upload policy document
- `POST /api/policy/query` - Query documents
- `GET /api/policy/documents` - List uploaded documents

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the AGPL-3.0 License.

## Migration Notes

This project is a complete rewrite of the original Django-based CAF GPT application, migrated to a modern serverless architecture for improved performance, scalability, and cost-effectiveness.
