# LEAVE PolicyFoo Handler

> **🤖 AI Agent Navigation** | **Status**: ✅ Production Ready | **Complexity**: Medium (2-stage workflow)

## 🔍 Quick Reference

**Entry Point**: `index.ts` → `handleLEAVEQuery()` function  
**Workflow**: Finder Agent → Main Agent → Response (simplified vs DOAD)  
**Database**: Neon Postgres via Hyperdrive with chapter-based structure  
**Models**: Reader Model (Haiku) + Main Model (Sonnet)  
**Performance**: ~3-7 seconds, ~2000-3000 tokens per query

**Key Files**: `index.ts` (orchestration), `finder.ts` (chapter ID), `main.ts` (processing), `database.service.ts` (DB ops), `types.ts` (LEAVE types)

**Related**: `../README.md` (PolicyFoo overview), `../doadFoo/README.md` (3-stage comparison), `../types.ts` (shared types)

## Purpose

Simplified two-stage LLM workflow for CAF Leave policy questions. Optimized for chapter-based policy structure with streamlined architecture compared to DOAD handler.

## Directory Structure

```
leaveFoo/
├── README.md              # This documentation
├── index.ts               # Handler orchestration (simplified)
├── finder.ts              # Chapter identification agent
├── main.ts                # Policy processing agent
├── database.service.ts    # Database operations for chapter chunks
├── types.ts               # LEAVE-specific types
└── prompts/               # LLM prompts
    ├── finder.md          # Finder agent instructions
    └── main.md            # Main agent instructions
```

## 🔄 Integration Points

### With Parent Module

- **Router**: Called when policy_set is "LEAVE"
- **Types**: Uses shared interfaces from `../types.ts`
- **AI Gateway**: Uses PolicyFoo wrapper for service calls

### With Database

- **Operations**: Chapter-based content retrieval
- **Performance**: Optimized queries for chapter structure
- **Schema**: Chapter-organized content with metadata

### With AI Models

- **Reader Model**: Chapter identification (lightweight)
- **Main Model**: Policy response synthesis
- **Optimization**: ~40% token reduction vs DOAD

## Key Features

### Two-Stage Workflow

1. **Finder**: Identifies relevant leave policy chapters
2. **Main Agent**: Processes chapter content into comprehensive response

### Performance vs DOAD

- **Stages**: 2 vs 3 (no metadata selector needed)
- **Token Usage**: ~2000-3000 vs ~2500-4500 per query
- **Response Time**: ~3-7 vs ~5-12 seconds
- **Cost**: ~40% lower due to simplified workflow

## Development

### Core Components

- **`index.ts`**: Orchestrates 2-stage workflow with error handling
- **`finder.ts`**: Chapter identification using READER_MODEL
- **`main.ts`**: Response synthesis using MAIN_MODEL with XML output
- **`database.service.ts`**: Optimized chapter-based database operations

### Database Schema

```sql
Chapter-based structure: organized by leave types (Annual, Medical, etc.)
Indexes: optimized for chapter-based queries
```

### Model Configuration

- **READER_MODEL**: `anthropic/claude-3-haiku` (identification)
- **MAIN_MODEL**: `anthropic/claude-3-5-sonnet` (synthesis)

### Adding New Leave Policies

1. Process content into chapter-based structure
2. Insert into database via `database.service.ts`
3. Update prompts if needed
4. Test workflow stages
