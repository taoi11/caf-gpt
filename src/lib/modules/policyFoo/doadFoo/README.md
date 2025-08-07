# DOAD PolicyFoo Handler

> **🤖 AI Agent Navigation** | **Status**: ✅ Production Ready | **Complexity**: High (3-stage workflow)

## 🔍 Quick Reference

**Entry Point**: `index.ts` → `handleDOADQuery()` orchestration function  
**Workflow**: Finder Agent → Metadata Selector → Main Agent → Response  
**Database**: Neon Postgres via Hyperdrive with intelligent chunking and metadata  
**Models**: Reader Model (Haiku) + Main Model (Sonnet)  
**Performance**: ~3-5 seconds, ~2500-4500 tokens per query

**Key Files**: `index.ts` (orchestration), `finder.ts` (policy ID), `metadata-selector.ts` (chunk selection), `main.ts` (synthesis), `database.service.ts` (DB ops)

**Related**: `../README.md` (PolicyFoo overview), `../types.ts` (shared types), `../../../routes/policy/` (UI)

## Purpose

Three-stage LLM workflow for DOAD policy questions with authoritative citations. Uses database-driven architecture with metadata-based chunk selection for accurate policy identification and response generation.

## Directory Structure

```
doadFoo/
├── README.md                  # This documentation
├── index.ts                   # Main orchestration handler
├── finder.ts                  # Policy identification agent
├── main.ts                    # Policy synthesis agent
├── database.service.ts        # Database operations
├── metadata-selector.ts       # Intelligent chunk selection
├── types.ts                   # DOAD-specific types
└── prompts/                   # LLM prompts
    ├── main.md                # Main agent prompt
    ├── finder.md              # Finder agent prompt
    ├── metadata-selector.md   # Chunk selection prompt
    └── DOAD-list-table.md     # Available policies reference
```

## 🔄 Integration Points

### With Parent Module

- **Router**: Called when policy_set is "DOAD"
- **Types**: Uses shared interfaces from `../types.ts`
- **AI Gateway**: Uses PolicyFoo wrapper for service calls

### With Database

- **Operations**: Retrieves metadata and content for identified policies
- **Performance**: Connection pooling and indexed queries
- **Schema**: `public.doad` table with chunked content and metadata

### With AI Models

- **Reader Model**: Finder and metadata selector (lightweight tasks)
- **Main Model**: Final response synthesis (complex reasoning)
- **Optimization**: Metadata selection reduces content by ~70%

## Key Features

### Three-Stage Workflow

1. **Finder**: Identifies relevant DOAD policy numbers (max 5)
2. **Metadata Selector**: Chooses most relevant content chunks via LLM
3. **Main Agent**: Synthesizes selected content into comprehensive response

### Performance Characteristics

- **Token Usage**: ~2500-4500 tokens per query
- **Response Time**: ~5-12 seconds (varies by chunk count)
- **Accuracy**: High precision via multi-stage filtering
- **Cost**: Higher than LEAVE handler due to multiple AI calls

## Development

### Core Components

- **`index.ts`**: Orchestrates 3-stage workflow with error handling
- **`finder.ts`**: Policy number identification using READER_MODEL
- **`metadata-selector.ts`**: LLM-powered chunk selection for relevance
- **`main.ts`**: Response synthesis using MAIN_MODEL with XML output
- **`database.service.ts`**: Optimized Postgres operations with retry logic

### Database Schema

```sql
public.doad: id (UUID), text_chunk (TEXT), metadata (JSONB), doad_number (TEXT)
Indexes: doad_number, GIN on metadata
```

### Model Configuration

- **READER_MODEL**: `anthropic/claude-3-haiku` (identification/selection)
- **MAIN_MODEL**: `anthropic/claude-3-5-sonnet` (synthesis)

### Adding New Policies

1. Process content into chunks with metadata
2. Insert into database via `database.service.ts`
3. Update `DOAD-list-table.md` reference
4. Test workflow stages
