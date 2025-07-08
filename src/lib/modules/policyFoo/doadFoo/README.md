# DOAD PolicyFoo Handler

## Purpose
LLM workflow for answering questions related to DOAD (Defence Administrative Orders and Directives) policies with authoritative citations. Implements a sophisticated database-driven architecture with metadata-based chunk selection for accurate policy identification and comprehensive response generation.

**See also**: [PolicyFoo Main Documentation](../README.md) | [LEAVE Handler](../leaveFoo/README.md)

## Overview
The DOAD handler processes policy queries through an enhanced three-stage database-driven workflow:
1. **Stage 1**: Finder Agent identifies relevant DOAD policy numbers using lightweight model
2. **Stage 2**: Database retrieval of metadata for identified DOADs + Metadata Selector Agent selects most relevant chunks using LLM analysis
3. **Stage 3**: Main Agent synthesizes selected chunk content and generates structured responses

**Architecture Note**: This uses a database-driven approach with Neon Postgres for efficient chunk-based content retrieval with intelligent metadata selection, unlike the [LEAVE handler](../leaveFoo/README.md) which uses a single-stage workflow with R2 storage.

## Enhanced Workflow
  1. Receives a user message from `policyFoo` Router as init, or a continuation of a conversation (`user` + `assistant` message sequence)
  2. Routes the message or conversation to `src/lib/modules/policyFoo/doadFoo/finder.ts` 
  3. Receives the `assistant` message from finder.ts containing DOAD policy numbers relevant to the user question
  4. **Database Phase**: Retrieves metadata for identified DOADs from Neon Postgres using `database.service.ts`
  5. **Metadata Selection**: Routes metadata to `metadata-selector.ts` which uses LLM to intelligently select most relevant chunks
  6. **Content Retrieval**: Retrieves full content for selected chunks from database using optimized queries
  7. Sends the user message/conversation + selected chunk content to `src/lib/modules/policyFoo/doadFoo/main.ts`
  8. Receives the `assistant` message from `main.ts` with structured response and citations
  9. Sends the updated conversation to the `policyFoo` Router

## Database Integration

The DOAD handler uses a Neon Postgres database for high-performance content retrieval:

- **Schema**: `public.doad` table with `id`, `text_chunk`, `metadata` (JSONB), `doad_number`, `created_at` columns
- **Chunking**: Policies are pre-chunked with structured metadata for intelligent selection
- **Selection**: Three-phase selection (DOAD numbers → metadata analysis → relevant chunks) for maximum precision
- **Performance**: Connection pooling, indexed queries, and retry logic optimized for Cloudflare Workers
- **Monitoring**: Slow query detection (>500ms) and performance logging for optimization
- **LLM Formatting**: Enhanced chunk formatting with metadata integration for improved agent understanding

## Implementation Details

### Core Components

#### 1. Handler Orchestration (`index.ts`)
- **Entry Point**: Main handler function `handleDOADQuery()`
- **Configuration Loading**: Loads prompts and AI model settings
- **Three-Stage Coordination**: Orchestrates finder → metadata selector → main agent workflow
- **Error Handling**: Comprehensive error handling with graceful degradation
- **Database Integration**: Manages Postgres operations for policy content retrieval

#### 2. Finder Agent (`finder.ts`)
- **Purpose**: Identifies relevant DOAD policy numbers from user queries
- **Model**: Uses `READER_MODEL` (lightweight, fast identification)
- **Input**: User conversation + finder prompt + policy list table
- **Output**: Comma-separated policy numbers (max 5) or "none"
- **Parsing**: Handles various response formats and edge cases

#### 3. Database Service (`database.service.ts`)
- **Purpose**: Optimized database operations for chunk retrieval and metadata analysis
- **Functions**: `getDOADChunksByNumbers()`, `getDOADMetadataByNumbers()`, `getDOADChunksByIds()`
- **Performance**: Connection pooling, indexed queries, and efficient data transfer
- **Error Handling**: Retry logic with exponential backoff for resilient operations

#### 4. Metadata Selector (`metadata-selector.ts`)
- **Purpose**: LLM-powered intelligent chunk selection based on metadata analysis
- **Model**: Uses `READER_MODEL` (lightweight, efficient for selection tasks)
- **Input**: User query + chunk metadata (optimized for LLM processing)
- **Output**: Selected chunk IDs for final content retrieval
- **Optimization**: Reduces database load and improves response relevance

#### 5. Main Agent (`main.ts`)
- **Purpose**: Synthesizes selected policy content and generates comprehensive responses
- **Model**: Uses `MAIN_MODEL` (capable synthesis and reasoning)
- **Input**: User conversation + main prompt + selected chunk content
- **Output**: Structured XML response with answer, citations, follow-up
- **Format**: Returns raw XML for frontend parsing

### Configuration

#### Models Used
- **READER_MODEL**: `anthropic/claude-3-haiku` (default)
  - Optimized for quick policy identification
  - Cost-effective for simple extraction tasks
- **MAIN_MODEL**: `anthropic/claude-3-5-sonnet` (default)
  - Advanced reasoning for policy synthesis
  - Better citation accuracy and context understanding

#### File Structure
```
doadFoo/
├── README.md                  # This documentation
├── index.ts                   # Handler orchestration
├── finder.ts                  # Policy identification agent
├── main.ts                    # Policy synthesis agent
├── database.service.ts        # Database operations and optimization
├── metadata-selector.ts       # LLM-powered chunk selection
├── types.ts                   # DOAD-specific type definitions
└── prompts/                   # LLM prompts
    ├── finder.md              # Finder agent instructions
    ├── main.md                # Main agent instructions
    ├── metadata-selector.md   # Metadata selector instructions
    └── DOAD-list-table.md     # Available policies reference
```

#### Database Schema
```sql
-- Neon Postgres table for DOAD policy chunks
public.doad
├── id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
├── text_chunk      TEXT NOT NULL                    # Policy content chunk
├── metadata        JSONB                            # Structured metadata for selection
├── doad_number     TEXT                             # Policy number (indexed)
└── created_at      TIMESTAMP DEFAULT NOW()          # Audit trail

-- Indexes for performance
CREATE INDEX idx_doad_number ON doad(doad_number);
CREATE INDEX idx_doad_metadata ON doad USING GIN(metadata);
```

### Agent Prompts

#### Finder Prompt (`prompts/finder.md`)
- **Objective**: Extract relevant policy numbers only
- **Format**: Comma-separated list or "none"
- **Constraints**: Maximum 5 policies, specific format requirements
- **Reference**: Uses DOAD list table for available policies

#### Metadata Selector Prompt (`prompts/metadata-selector.md`)
- **Objective**: Select most relevant chunks based on metadata analysis
- **Format**: Comma-separated chunk IDs
- **Input**: User query + optimized metadata for each chunk
- **Optimization**: Reduces token usage while maintaining selection accuracy

#### Main Prompt (`prompts/main.md`)
- **Objective**: Generate comprehensive policy responses
- **Format**: Structured XML with answer, citations, follow-up
- **Features**: Citation accuracy, follow-up question generation
- **Context**: Selected chunk content and conversation history

#### Policy List (`prompts/DOAD-list-table.md`)
- **Purpose**: Reference table of available DOAD policies
- **Format**: Structured list with policy numbers and descriptions
- **Usage**: Helps finder agent identify relevant policies
- **Maintenance**: Updated as new policies are added

### Response Structure

#### Finder Agent Output
```typescript
{
  policyNumbers: ["5017-1", "7021-3"],  // Array of relevant policies
  usage: { prompt_tokens: 150, completion_tokens: 12, total_tokens: 162 }
}
```

#### Metadata Selector Output
```typescript
{
  selectedChunkIds: ["uuid1", "uuid2", "uuid3"],  // Selected chunk IDs
  usage: { prompt_tokens: 300, completion_tokens: 25, total_tokens: 325 }
}
```

#### Main Agent Output
```typescript
{
  response: "<response><answer>...</answer><citations>...</citations><follow_up>...</follow_up></response>",
  usage: { prompt_tokens: 2000, completion_tokens: 400, total_tokens: 2400 }
}
```

#### Combined Handler Response
```typescript
{
  message: "Raw XML response from main agent",
  usage: {
    finder: { prompt_tokens: 150, completion_tokens: 12, total_tokens: 162 },
    metadataSelector: { prompt_tokens: 300, completion_tokens: 25, total_tokens: 325 },
    main: { prompt_tokens: 2000, completion_tokens: 400, total_tokens: 2400 }
  }
}
```

### Error Handling

#### Policy Not Found
- **Scenario**: No policies match the user query
- **Response**: Generates helpful "no policies found" message
- **Features**: Suggests rephrasing, asks for more context
- **Fallback**: Graceful degradation without breaking conversation

#### Missing Policy Data
- **Scenario**: Policy numbers identified but chunks missing from database
- **Behavior**: Continues with available chunks, logs warnings
- **User Experience**: Partial responses better than complete failure
- **Recovery**: Clear indication of which policies couldn't be loaded

#### Database Connection Failures
- **Retry Logic**: Exponential backoff with up to 3 attempts per query
- **Connection Pooling**: Automatic connection management and recovery
- **Error Propagation**: Clear error messages to frontend
- **Monitoring**: Performance logging and slow query detection

#### AI Service Failures
- **Retry Logic**: Built into shared AI Gateway service (`$lib/server/ai-gateway.service.js`)
- **Error Propagation**: Clear error messages to frontend
- **Logging**: Comprehensive error logging for debugging
- **Fallback**: Service degradation rather than complete failure

### Performance Characteristics

#### Token Efficiency
- **Finder Stage**: ~150-300 tokens per query (lightweight)
- **Metadata Selector**: ~300-600 tokens per query (optimized metadata)
- **Main Stage**: ~1500-3000 tokens per query (selected content only)
- **Total**: Improved efficiency through intelligent chunk selection

#### Response Times
- **Finder Agent**: ~1-2 seconds (fast identification)
- **Database Metadata Retrieval**: ~100-300ms (indexed queries)
- **Metadata Selector**: ~1-2 seconds (lightweight LLM analysis)
- **Database Content Retrieval**: ~100-200ms (optimized chunk queries)
- **Main Agent**: ~3-6 seconds (focused synthesis)
- **Total**: ~6-11 seconds end-to-end (improved through optimization)

#### Scalability
- **Stateless**: No server-side storage requirements
- **Concurrent**: Connection pooling handles multiple simultaneous requests
- **Database Access**: Optimized queries with proper indexing
- **Memory**: Minimal memory footprint per request
- **Performance Monitoring**: Automatic slow query detection and logging

### Development Guidelines

#### Adding New Policies
1. Process policy content into chunks with metadata
2. Insert chunks into Postgres database using `database.service.ts`
3. Update `DOAD-list-table.md` with policy details
4. Test finder agent can identify the new policy
5. Verify metadata selector can choose relevant chunks
6. Confirm main agent can process selected content

#### Prompt Modifications
1. **Finder Prompt**: Focus on identification accuracy
2. **Metadata Selector Prompt**: Optimize for chunk selection precision
3. **Main Prompt**: Emphasize citation quality and structure
4. **Testing**: Validate with diverse query types
5. **Versioning**: Document prompt changes for tracking

#### Error Scenarios Testing
- Missing policy chunks in database
- Database connection failures
- Malformed metadata content
- AI service timeouts
- Invalid policy numbers
- Empty user queries
- Slow database queries

### Integration Points

#### With PolicyFoo Router
- **Input**: `PolicyQueryInput` with messages and policy set
- **Output**: `PolicyQueryOutput` with XML response and usage
- **Error Handling**: Throws `PolicyFooError` for Router to handle

#### With Neon Postgres Database
- **Connection Management**: Pool-based connections with automatic retry
- **Query Optimization**: Indexed queries for fast chunk retrieval
- **Error Handling**: Graceful handling of connection failures and timeouts
- **Performance Monitoring**: Slow query detection and logging

#### With AI Gateway
- **Triple Models**: Separate services for finder, metadata selector, and main agents via shared AI Gateway
- **Configuration**: Independent model selection per agent using PolicyFoo wrapper
- **Usage Tracking**: Token usage for all three stages through shared service

### Future Enhancements

#### Planned Features
- **Policy Versioning**: Handle multiple versions of same policy in database
- **Cross-References**: Link related policies automatically using metadata
- **Semantic Search**: Enhanced policy discovery using vector embeddings
- **Query Caching**: Database query result caching for improved performance
- **Metadata Enhancement**: Richer metadata for better chunk selection

#### Architecture Evolution
- **Vector Search**: Consider adding semantic search capabilities to complement metadata selection
- **Shared Components**: Extract common database patterns for use with other policy handlers
- **Performance Optimization**: Continue optimizing database queries and connection pooling
- **Metadata Standards**: Develop standardized metadata schemas for consistent chunk selection

**See also**: [LEAVE Handler optimizations](../leaveFoo/README.md#performance-characteristics) for comparison