# CAF-GPT Application Plan

## Overview
A collection of AI tools and agents for army personnel, packaged as a Node.js Docker container.

## Core Principles
- Keep user messages browser-side only
- Prevent user identifiable data from entering logs
- Provide simple and minimal tool interfaces
- Use minimal dependencies and frameworks
- Maintain clear separation of client and server code
- Use read-only data access patterns

## Technology Stack
- Node.js for server-side logic
- TypeScript for type-safe JavaScript
  - Separate client and server builds
  - ES modules for modern import/export
  - Strict type checking enabled
- Custom CSS for styling
- HTML with vanilla JavaScript
- Docker for containerization
- Storj S3-compatible storage
  - Uses AWS S3 SDK
  - Gateway endpoint at gateway.storjshare.io
  - Read-only access configuration

## Project Structure
```
cap-gpt/
├── .appLogic/                    # Application documentation
│   ├── overview.md              # Main project documentation
│   ├── paceNote.md             # Pace Notes tool documentation
│   └── rateLimiter.md          # Rate Limiter documentation
├── src/                         # Source code directory
│   ├── types.ts                # Global type definitions
│   ├── prompts/                # System prompts
│   │   └── paceNote.md        # Pace Notes prompt
│   ├── client/                 # Client-side TypeScript
│   │   └── paceNotes.ts       # Pace Notes client code
│   └── server/                 # Server-side TypeScript
│       ├── config.ts          # Server configuration
│       ├── api/               # API endpoints
│       │   ├── utils/         # Server utilities
│       │   │   ├── llmGateway.ts  # LLM Gateway
│       │   │   ├── s3Client.ts    # S3/Storj client
│       │   │   └── rateLimiter.ts # Rate limiting logic
│       │   └── paceNotes/     # Pace Notes API
│       │       ├── paceNoteAgent.ts # Core logic
│       │       └── paceNotes.ts     # Route handler
│       └── index.ts           # Main server entry point
├── public/                     # Static assets
│   ├── index.html             # Landing page
│   ├── paceNotes.html         # Pace Notes tool page
│   ├── css/                   # CSS files
│   │   ├── common.css        # Common styles
│   │   ├── index.css        # Landing page styles
│   │   └── paceNote.css     # Pace Notes styles
│   └── js/                    # Compiled client JavaScript
├── dist/                      # Compiled server code
├── .env.example               # Environment variables template
├── .gitignore                # Git ignore file
├── Dockerfile                # Docker configuration
├── package.json              # Project configuration
├── tsconfig.client.json      # Client TypeScript config
└── tsconfig.server.json      # Server TypeScript config
```

## Storage Architecture
### S3-Compatible Storage (Storj)
- Uses AWS S3 SDK for compatibility
- Fixed endpoint at gateway.storjshare.io
- Read-only access configuration:
  - List bucket contents
  - Read object data
  - No write or delete permissions
- Configuration via environment variables:
  - `S3_BUCKET_NAME`: Target bucket
  - `S3_ACCESS_KEY_ID`: Read-only access credentials
  - `S3_SECRET_ACCESS_KEY`: Read-only secret credentials

## Frontend Architecture
- Simple, clean interfaces
- Responsive design with custom CSS
- Real-time feedback and loading states
- Error handling with user feedback
- Copy-to-clipboard functionality
- Keyboard shortcuts where appropriate

## Development Setup
- TypeScript configurations split for client/server:
  - Client code (`src/client/`) compiles to `public/js/`
  - Server code (`src/server/`) compiles to `dist/server/`
- Development runs on port 3000 with file watching
- ES modules used throughout

Available scripts:
- `npm run dev`: Start development with concurrent compilation
- `npm run build`: Build production files
- `npm run clean`: Reset build directories

## Container Architecture
- Multi-stage Docker build process:
  1. Build Stage:
     - Installs dependencies
     - Compiles TypeScript
  2. Production Stage:
     - Copies production files
     - Runs server

## Deployment Strategy
- Local Development:
  - Uses `npm run dev` with file watching
  - Concurrent compilation
- Docker Deployment:
  - Single container runs compiled code
  - Server serves static files
  - No runtime compilation

## Recent Changes
- Implemented read-only data access patterns
- Moved system prompts to markdown files
- Simplified client-side code
- Improved error handling
- Added concurrent compilation
- Enhanced documentation
