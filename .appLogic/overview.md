# CAF-GPT Application Plan

## Overview
A collection of AI tools and agents for army personnel, packaged as a Node.js Docker container.

## Core Principles
- Keep user messages browser-side only
- Prevent user identifiable data from entering logs
- Provide simple and minimal tool interfaces
- Use minimal dependencies and frameworks
- Maintain clear separation of client and server code

## Technology Stack
- Node.js for server-side logic
- TypeScript for type-safe JavaScript
  - Separate client and server builds
  - ES modules for modern import/export
  - Strict type checking enabled
- Custom CSS for styling
- HTML with Web Components
- Docker for containerization

## Complete Project Structure
```
cap-gpt/
├── .appLogic/                    # Application documentation
│   ├── overview.md              # Main project documentation
│   └── paceNote.md             # Pace Notes tool documentation
├── src/                          # Source code directory
│   ├── client/                  # Client-side TypeScript
│   │   ├── common/             # Shared client utilities
│   │   │   ├── types.ts       # Shared type definitions
│   │   │   └── utils.ts       # Utility functions
│   │   ├── index.ts           # Main client entry point
│   │   └── paceNotes/         # Pace notes client code
│   │       ├── components/    # Web Components
│   │       │   ├── input-box.ts
│   │       │   └── output-box.ts
│   │       ├── index.ts      # Pace Notes entry point
│   │       └── types.ts      # Pace Notes types
│   └── server/                 # Server-side TypeScript
│       ├── api/               # API endpoints
│       │   └── paceNotes/    # Pace notes API
│       │       ├── index.ts  # Route handler
│       │       ├── prompt.ts # System prompt
│       │       └── types.ts  # API types
│       ├── middleware.ts     # Request handling
│       └── index.ts         # Main server entry point
├── public/                      # Static assets
│   ├── index.html              # Landing page
│   ├── paceNotes.html          # Pace notes tool page
│   ├── favicon.ico             # Site favicon
│   ├── css/                    # CSS files
│   │   ├── main.css           # Main styles
│   │   └── paceNote.css       # Pace note tool styles
│   └── js/                     # Compiled client JavaScript
│       ├── common/            # Compiled common utilities
│       │   ├── types.js      
│       │   └── utils.js
│       ├── index.js           # Compiled main client
│       └── paceNotes/        # Compiled Pace Notes
│           ├── components/
│           ├── index.js
│           └── types.js
├── dist/                        # Compiled server code
│   └── server/                 # Server-side compiled JS
│       ├── api/
│       │   └── paceNotes/
│       ├── middleware.js
│       └── index.js
├── node_modules/                # Project dependencies
├── .gitignore                  # Git ignore file
├── Dockerfile                  # Docker configuration
├── package.json                # Project configuration
├── tsconfig.json              # Server TypeScript config
└── tsconfig.client.json       # Client TypeScript config
```

## Frontend Architecture

### Main Page Layout
- nav bar on top of page
- Tools cards
   - Each card has a title and description of the tool
   - One line status of the implementation progress
   - Clickable button to navigate to the tool page

### Styling Strategy
- Write custom CSS for styling
- Focus on simplicity and maintainability
- Single main.css file for core styles
- Tool-specific CSS files when needed

## Development Environment
- Separate TypeScript configurations for client and server
- Client TypeScript (`src/client/`) → Compiles to `public/js/`
- Server TypeScript (`src/server/`) → Compiles to `dist/server/`
- Development server runs on port 3000
- Watch mode for both client and server code
- ES modules used throughout the codebase

## Development Scripts
- `npm run dev` - Start development environment
  - Watches and compiles server TypeScript
  - Watches and compiles client TypeScript
  - Serves static files from public directory
- `npm run build` - Build both client and server
- `npm run build:client` - Build only client code
- `npm run build:server` - Build only server code
- `npm run clean` - Clean compiled files

## Container Architecture
- Multi-stage Docker build process:
  1. Build Stage:
     - Installs all dependencies (including dev dependencies)
     - Compiles client TypeScript to `public/js`
     - Compiles server TypeScript to `dist/server`
  2. Production Stage:
     - Copies only production dependencies
     - Copies compiled server code (`dist/server`)
     - Copies static files (`public` directory)
     - Runs server using `node dist/server/index.js`

### Container File Structure
```
/app/
├── dist/                    # Compiled server code
│   └── server/             # Server-side JS
├── public/                 # Static assets
│   ├── js/                # Compiled client JS
│   ├── css/               # CSS files
│   └── *.html             # HTML files
├── node_modules/          # Production dependencies only
└── package.json
```

## Deployment Strategy
- Local Development:
  - Uses `npm run dev` with file watching
  - Separate processes for client and server
- Docker Deployment:
  - Single container runs compiled server code
  - Server serves static files from `public` directory
  - No TypeScript compilation in production
- Cloudflare Pages Alternative:
  - Static content deployed to Cloudflare Pages
  - Edge functions for API endpoints
  - Static assets served from /public directory
  - Server code deployed as Edge Functions

## Recent Changes
- Implemented ES modules for modern import/export
- Separated client and server TypeScript builds
- Added proper TypeScript project references
- Set up multi-stage Docker build process
- Organized static file serving structure
- Added development watch mode for both client and server
