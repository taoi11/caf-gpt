# CAF GPT - Go + HTMX Version

This is the Go + HTMX rewrite of the CAF GPT application, originally built with SvelteKit.

## Features

- **PaceNoteFoo**: Generate professional pace notes using AI with rank-specific competency frameworks
- **PolicyFoo**: Ask questions about CAF policies and get authoritative answers with citations

## Technology Stack

- **Backend**: Go 1.23
- **Frontend**: HTMX + Custom CSS (Tailwind-inspired)
- **Storage**: Tigris S3-compatible storage
- **AI**: OpenRouter API
- **Deployment**: Fly.io

## Project Structure

```
├── cmd/cafgpt/           # Main application entry point
├── internal/
│   ├── config/           # Configuration management
│   ├── handlers/         # HTTP handlers (pages + HTMX partials)
│   ├── services/         # Business logic services
│   │   ├── openrouter.go # OpenRouter API client
│   │   ├── pacenote_service.go
│   │   └── policy_service.go
│   ├── storage/          # Tigris S3 storage client
│   └── templates/        # HTML templates
├── static/               # Static assets (CSS, JS)
└── Dockerfile           # Container build file
```

## Environment Variables

Required environment variables:

```bash
# Server
PORT=8080

# OpenRouter API
OPENROUTER_API_KEY=your_openrouter_key

# Tigris S3 Storage
AWS_ACCESS_KEY_ID=your_tigris_access_key
AWS_SECRET_ACCESS_KEY=your_tigris_secret_key
AWS_ENDPOINT_URL_S3=https://fly.storage.tigris.dev
AWS_REGION=auto
BUCKET_NAME=your_bucket_name

# AI Models
FN_MODEL=anthropic/claude-3.5-sonnet
READER_MODEL=anthropic/claude-3.5-sonnet
MAIN_MODEL=anthropic/claude-3.5-sonnet
```

## Development

### Prerequisites

- Go 1.23+
- Access to Tigris storage with prompt files

### Running Locally

1. Set environment variables
2. Build and run:

```bash
go build -o cafgpt ./cmd/cafgpt
./cafgpt
```

### Building

```bash
go build -o cafgpt ./cmd/cafgpt
```

### Docker

```bash
docker build -t cafgpt .
docker run -p 8080:8080 --env-file .env cafgpt
```

## API Endpoints

### Pages
- `GET /` - Home page
- `GET /pacenote` - PaceNote generator page
- `GET /policy` - Policy assistant page

### HTMX Partials
- `POST /pacenote/generate` - Generate pace note
- `POST /policy/ask` - Ask policy question
- `POST /policy/clear` - Clear conversation

### Health
- `GET /health` - Health check endpoint

## Differences from SvelteKit Version

### Architecture
- **Server-side rendering**: All pages rendered on server vs client-side SPA
- **HTMX interactions**: Progressive enhancement vs full JavaScript framework
- **Embedded templates**: Templates compiled into binary vs separate files
- **Single binary**: Self-contained executable vs Node.js + dependencies

### Performance
- **Faster startup**: No JavaScript bundle compilation
- **Lower memory**: Go's efficient memory management
- **Better caching**: Static assets served from embedded filesystem

### Deployment
- **Simpler deployment**: Single binary vs Node.js runtime
- **Smaller container**: Alpine-based vs Node.js base image
- **No build step**: Templates embedded at compile time

## Prompt Files

The application expects prompt files to be available in Tigris storage:

```
pacenote/prompts/base.md
paceNote/examples.md
paceNote/cpl.md
paceNote/mcpl.md
paceNote/sgt.md
paceNote/wo.md
policy/doad/prompts/finder.md
policy/doad/prompts/main.md
policy/doad/prompts/DOAD-list-table.md
policy/leave/prompts/main.md
leave/consolidated_policies.md
```

## Health Check

The application provides a health check endpoint at `/health`:

```json
{
  "status": "ok",
  "timestamp": "2025-07-04T21:21:34.967798155Z",
  "version": "1.0.0",
  "config": {
    "configured": true
  }
}
```

## Contributing

1. Follow Go conventions and best practices
2. Keep templates simple and semantic
3. Use HTMX for progressive enhancement
4. Maintain compatibility with existing prompt files
5. Test all functionality before committing