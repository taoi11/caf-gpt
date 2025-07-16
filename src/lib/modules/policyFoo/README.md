# PolicyFoo Service

> **Internal Developer/Agent Reference** - Policy question answering with authoritative citations

## Purpose

LLM-powered service for answering policy/regulation questions with authoritative citations. Uses a router-based architecture that directs queries to specialized policy-specific agents.

## Overview

PolicyFoo implements a stateless, router-based architecture with specialized handlers:

- **DOAD Handler** (`doadFoo/`) - Three-stage workflow (finder → metadata selector → main agent)
- **LEAVE Handler** (`leaveFoo/`) - Single-stage workflow (main agent only)
- **Router** (`index.ts`) - Validates input and routes to appropriate handler

**Key Design Principles:**
- **Stateless**: No server-side conversation storage
- **Context Passing**: Full conversation history sent with each request
- **Scalable**: Each request is independent and can scale infinitely
- **Cost Efficient**: Model selection optimized for each task type

## Handler Comparison

| Feature              | DOAD Handler                                  | LEAVE Handler                              |
| -------------------- | --------------------------------------------- | ------------------------------------------ |
| **Workflow**         | Database-driven with metadata selection       | Database-driven with chapter identification |
| **Policy Storage**   | Postgres database with chunking               | Postgres database with chapter-based chunking |
| **Models Used**      | READER_MODEL + Metadata Selector + MAIN_MODEL | READER_MODEL + MAIN_MODEL                   |
| **Token Efficiency** | ~2500-4500 per query                          | ~2000-3000 per query                       |
| **Response Time**    | ~5-12 seconds                                 | ~3-7 seconds                               |
| **Cost**             | Higher (multiple AI calls)                    | Lower (~40% savings)                       |

## Architecture

**Route**: `/policy`

**Shared Infrastructure:**
- **AI Gateway Integration**: Uses shared AI Gateway service from `$lib/server/ai-gateway.service.js`
- **Database**: Neon Postgres for all policy content with optimized indexing
- **Error Handling**: Unified error types and handling patterns
- **Response Format**: Both return identical XML structure for frontend parsing

## Policy Sets

### DOAD (Defence Administrative Orders and Directives)
**Status**: ✅ Production Ready  
**Documentation**: [DOAD Handler Details](./doadFoo/README.md)
- Database-driven with intelligent chunk selection
- Three-stage AI workflow for maximum accuracy
- Postgres storage with metadata-based optimization

### LEAVE (Leave Policies)
**Status**: ✅ Production Ready  
**Documentation**: [LEAVE Handler Details](./leaveFoo/README.md)
- Database-driven with chapter identification
- Two-stage workflow with finder agent for chapter selection
- Postgres storage with chapter-based chunking

## Implementation

### Core Files

- **`index.ts`** - Main router with validation and policy set routing
- **`types.ts`** - Complete TypeScript type definitions
- **`constants.ts`** - Configuration constants and error messages
- **`ai-gateway.util.ts`** - PolicyFoo-specific wrapper for shared AI Gateway service

### Usage Example

```typescript
import { processPolicyQuery } from '$lib/modules/policyFoo';

const result = await processPolicyQuery(
	{
		messages: [
			{ role: 'user', content: 'What are leave approval requirements?', timestamp: Date.now() }
		],
		policy_set: 'DOAD'
	},
	env
);
```

### Response Format

Returns raw XML responses that the frontend parses:

```xml
<response>
  <answer>Policy-based answer with detailed information...</answer>
  <citations>
    <citation>DOAD 5017-1: Leave Policy</citation>
  </citations>
  <follow_up>Would you like to know about specific types of leave?</follow_up>
</response>
```

## Directory Structure

```
policyFoo/
├── README.md                    # This file - High-level architecture
├── index.ts                     # Main router and entry point
├── types.ts                     # TypeScript type definitions
├── constants.ts                 # Configuration and constants
├── ai-gateway.util.ts           # PolicyFoo wrapper for shared AI Gateway service
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

## Environment Configuration

```bash
OPENROUTER_TOKEN=your_openrouter_token
AI_GATEWAY_BASE_URL=https://your-ai-gateway-url
CF_AIG_TOKEN=your_caf_aig_token
READER_MODEL=anthropic/claude-3-haiku  # Optional
MAIN_MODEL=anthropic/claude-3-5-sonnet # Optional
DATABASE_URL=postgres://user:password@host:port/db # Neon Postgres connection
```

## Development

### Adding New Policy Sets

1. Create new handler directory (e.g., `newPolicyFoo/`)
2. Implement handler following `PolicyQueryInput` → `PolicyQueryOutput` contract
3. Add policy set to `POLICY_SETS` constant
4. Update router switch statement in `index.ts`
5. Add database schema and services for policy storage
6. Update frontend policy selector

### Design Philosophy

- **Co-location**: Related functionality grouped together by policy set
- **Independent Modules**: Each handler can be developed and tested independently
- **Consistent Interfaces**: All handlers implement the same input/output contracts
- **Extensible**: Easy to add new policy sets following established patterns
