# PolicyFoo Service

> **🤖 AI Agent Navigation** | **Status**: ✅ Production Ready | **Domain**: Policy Q&A | **Complexity**: High

## 🔍 Quick Reference

**Entry Point**: `index.ts` → Router function that delegates to handlers  
**Handlers**: `doadFoo/` (DOAD policies), `leaveFoo/` (Leave policies)  
**Types**: `types.ts` → Shared policy types and interfaces  
**Route Integration**: `src/routes/policy/` → Chat UI + server logic  
**Dependencies**: AI Gateway, Neon Postgres, Multi-Agent LLM Workflow

**Key Files**: `index.ts` (router), `doadFoo/README.md` (3-stage workflow), `leaveFoo/README.md` (2-stage workflow)

**Related**: `src/routes/policy/+page.server.ts` (server integration)

## Purpose

LLM-powered service for answering policy/regulation questions with authoritative citations. Uses router-based architecture that directs queries to specialized policy-specific agents.

## Directory Structure

```
policyFoo/
├── README.md                    # This file - High-level architecture
├── index.ts                     # Main router and entry point
├── types.ts                     # TypeScript type definitions
├── constants.ts                 # Configuration and constants
├── doadFoo/                     # DOAD policy handler
│   ├── README.md               # DOAD-specific implementation details
│   ├── index.ts                # DOAD handler orchestration
│   ├── finder.ts               # Policy identification agent
│   ├── main.ts                 # Policy synthesis agent
│   ├── database.service.ts     # Database operations for policy chunks
│   ├── metadata-selector.ts    # Intelligent chunk selection
│   ├── types.ts                # DOAD-specific type definitions
│   └── prompts/                # LLM prompts
└── leaveFoo/                   # Leave policy handler
    ├── README.md               # LEAVE-specific implementation details
    ├── index.ts                # LEAVE handler orchestration
    ├── finder.ts               # Chapter identification agent
    ├── main.ts                 # Policy processing agent
    ├── database.service.ts     # Database operations for chapter chunks
    ├── types.ts                # LEAVE-specific type definitions
    └── prompts/                # LLM prompts
```

## 🔄 Integration Points

### With Routes (`src/routes/policy/`)

- **Message Handling**: Server actions process chat messages
- **UI Components**: Chat interface and citation rendering
- **Service Integration**: Imports router function from module

### With Shared Services

- **AI Gateway**: Direct use of shared AI Gateway service from `$lib/core/ai-gateway.service.js`
- **Database**: Neon Postgres via shared database client
- **Error Handling**: Unified error types and patterns

### Between Handlers

- **Shared Types**: Common interfaces in `types.ts`
- **Shared Infrastructure**: Database client, AI Gateway service
- **Consistent Response**: Both return XML for frontend parsing

## Key Features

### Router-Based Architecture

- **Policy Set Detection**: Routes to appropriate handler (DOAD/LEAVE)
- **Stateless Design**: No server-side conversation storage
- **Independent Scaling**: Each request scales independently
- **Context Passing**: Full conversation history with each request

### Handler Comparison

| Feature           | DOAD Handler                       | LEAVE Handler           |
| ----------------- | ---------------------------------- | ----------------------- |
| **Workflow**      | 3-stage (finder → selector → main) | 2-stage (finder → main) |
| **Database**      | Chunked content with metadata      | Chapter-based structure |
| **Token Usage**   | ~2500-4500 per query               | ~2000-3000 per query    |
| **Response Time** | ~5-12 seconds                      | ~3-7 seconds            |
| **Optimization**  | Precision-focused                  | Speed-focused           |

### Policy Sets

- **DOAD**: Production ready, 3-stage workflow, database-driven with intelligent chunk selection
- **LEAVE**: Production ready, 2-stage workflow, chapter identification with simplified workflow

## Development

### Adding New Policy Sets

1. Create new handler directory under `policyFoo/`
2. Implement handler following input/output contracts
3. Add policy set to router in `index.ts`
4. Update database schema for policy storage
5. Add frontend policy selector option

### Router Integration

- **Input Contract**: `PolicyQueryInput` with messages and policy set
- **Output Contract**: `PolicyQueryOutput` with XML response and usage
- **Error Handling**: Unified error patterns across handlers
- **Extensibility**: Easy addition of new policy sets
