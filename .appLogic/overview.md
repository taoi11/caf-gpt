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
- Direct environment variable usage
- Simplified configurations
- Robust testing with clean async handling

## Technology Stack
- Node.js for server-side logic
- TypeScript for type-safe JavaScript
  - Separate client and server builds
  - ES modules for modern import/export
  - Strict type checking enabled
- Jest for testing
  - ESM-compatible configuration
  - Proper async cleanup
  - High test coverage targets
- Custom CSS for styling
  - Slim navigation design
  - Modern UI components
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
│   ├── costTracker.md          # Cost tracking documentation
│   ├── rateLimiter.md          # Rate Limiter documentation
│   ├── policyFoo.md            # Policy tool base documentation
│   └── doadFoo.md             # DOAD policy tool documentation
src/
├── tests/                      # Test files
│   └── utils/                  # Utility tests
│       └── rateLimiter.test.ts # Rate limiter tests
├── prompts/
│   ├── paceNote/
│   │   └── paceNote.md    # Pace Notes prompt
│   └── policyFoo/
│       └── doad/
│           ├── policyFinder.md    # DOAD finder prompt
│           ├── policyReader.md    # DOAD reader prompt
│           └── chatAgent.md       # DOAD chat agent prompt
│           └── DOAD-list-table.md # Available DOADs list
│   ├── client/                 # Client-side TypeScript
│   │   ├── paceNotes.ts       # Pace Notes client code
│   │   └── policyFoo.ts       # Policy tool client code
│   └── server/                 # Server-side TypeScript
│       ├── api/               # API endpoints
│       │   ├── utils/         # Server utilities
│       │   │   ├── llmGateway.ts  # LLM Gateway
│       │   │   ├── s3Client.ts    # S3/Storj client
│       │   │   ├── costTracker.ts # Cost tracking
│       │   │   └── rateLimiter.ts # Rate limiting
│       │   ├── paceNotes/     # Pace Notes API
│       │   │   ├── paceNoteAgent.ts # Core logic
│       │   │   └── paceNotes.ts     # Route handler
│       │   └── policyFoo/     # Policy tool API
│       │       ├── policyFoo.ts     # Base handler
│       │       └── doad/            # DOAD implementation
│       │           ├── doadFoo.ts   # DOAD base class
│       │           └── agents/      # DOAD agents
│       │               ├── finderAgent.ts  # Policy finder
│       │               ├── readerAgent.ts  # Policy reader
│       │               └── chatAgent.ts    # User interaction
│       └── index.ts           # Main server entry point
├── public/                     # Static assets
│   ├── index.html             # Landing page
│   ├── paceNotes.html         # Pace Notes tool page
│   ├── policyFoo.html         # Policy tool page
│   ├── css/                   # CSS files
│   │   ├── common.css         # Shared styles
│   │   ├── paceNotes.css      # Pace Notes styles
│   │   └── policyFoo.css      # Policy tool styles
│   └── js/                    # Compiled client JavaScript
├── dist/                      # Compiled server code
├── coverage/                  # Test coverage reports (gitignored)
├── .env.example               # Environment variables template
├── Dockerfile                # Docker configuration
├── .gitignore                # Git ignore patterns
├── .dockerignore             # Docker ignore patterns
├── package.json              # Project configuration
├── tsconfig.client.json      # Client TypeScript config
└── tsconfig.server.json      # Server TypeScript config
```

## Environment Variables
Direct usage of environment variables for:
- S3 configuration
- LLM API settings
- Server configuration
- Rate limiting options

## Storage Architecture
### S3-Compatible Storage (Storj)
- Uses AWS S3 SDK for compatibility
- Fixed endpoint at gateway.storjshare.io
- Read-only access configuration
- Direct environment variable usage:
  - `S3_BUCKET_NAME`
  - `S3_ACCESS_KEY_ID`
  - `S3_SECRET_ACCESS_KEY`

## Frontend Architecture
### UI State Management
- Centralized state management per tool
- TypeScript interfaces for type safety
- Shared types between client/server
- State structure:
  ```typescript
  interface UIState {
    inputText: string;      // Form inputs
    messages: Message[];    // Chat/output history
    isProcessing: boolean;  // Loading states
  }
  ```

### UI Components
- Tool-specific UI classes
- Shared rate limiter display
- Common navigation elements
- State persistence:
  - Session storage for form inputs
  - In-memory for chat history
  - Real-time rate limit updates

### Event Handling
- Keyboard shortcuts (Ctrl+Enter)
- Copy-to-clipboard functionality
- Error message display
- Loading states
- Rate limit warnings

## Development Setup
- TypeScript configurations split for client/server
- Development runs on port 3000
- ES modules throughout
- Environment-aware features

Available scripts:
- `npm run dev`: Development mode
- `npm run build`: Production build
- `npm run clean`: Reset build
- `npm test`: Run tests with coverage

## Recent Changes
- **Type Restructuring**: 
  - Frontend-specific types have been moved to `src/client/utils/types.ts`.
  - Consolidated UI-related types into structured interfaces for better management.
  - Simplified tool-specific types to focus on core functionality.
  - Maintained clear separation of concerns between frontend, backend, and shared types.
