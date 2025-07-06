# DOAD Postgres Migration Implementation Plan

## Overview
Transition the DOAD policy lookup from S3/R2 storage to Neon.tech Postgres database to implement a two-phase selection process:
1. **Phase 1 (existing)**: Finder agent selects DOAD numbers from policy list
2. **Phase 2 (new)**: Database-driven chunk selection with metadata analysis

## Current Architecture Analysis

### Existing DOAD Flow (`src/lib/services/policyFoo/doadFoo/`)
1. **Finder Agent** (`finder.ts`) - Uses LLM to identify DOAD numbers from static table
2. **Policy Retrieval** (`index.ts`) - Fetches complete policy files from R2 bucket  
3. **Main Agent** (`main.ts`) - Synthesizes response from full policy content

### Database Schema (Already Exists)
```sql
Table "public.doad"
Column     | Type                         | Nullable | Default
-----------+------------------------------+----------+------------------
id         | uuid                         | not null | gen_random_uuid()
text_chunk | text                         | not null | 
metadata   | jsonb                        |          |
created_at | timestamp with time zone     |          | now()
doad_number| text                         |          |

Indexes:
"doad_pkey" PRIMARY KEY, btree (id)
"doad_number" btree (doad_number)
```

## Implementation Plan

### Phase 1: Database Infrastructure Setup

#### 1.1 Neon Database Connection
- **Install Neon Serverless Driver**: `npm install @neondatabase/serverless`
- **Configure Environment**: Add `DATABASE_URL` to `.dev.vars` and Wrangler secrets
- **Update Drizzle Config**: Change from SQLite to Postgres dialect
- **Create Database Client**: Centralized Neon client utility

#### 1.2 Database Schema Management
- **Create Schema File**: `src/lib/server/db/schema.ts` with Drizzle schema for DOAD table
- **Generate Types**: TypeScript types for database operations
- **Migration Scripts**: Setup for future schema changes

### Phase 2: Enhanced DOAD Handler Implementation

#### 2.1 Modified DOAD Flow Architecture
```
User Query 
    ↓
Finder Agent (identifies DOAD numbers) 
    ↓
Database Query (fetch all chunks for selected DOADs)
    ↓
Metadata Selector Agent (NEW - selects relevant chunks)
    ↓
Main Agent (synthesizes response from selected chunks)
```

#### 2.2 Core Components Updates

**2.2.1 Finder Agent (`finder.ts`)**
- **No Changes Required** - Keep existing DOAD number identification logic
- **Maintain Current Prompts** - Continue using DOAD list table prompt

**2.2.2 Database Service Layer (`NEW: database.service.ts`)**
```typescript
// Functions to implement:
- getDOADChunksByNumbers(doadNumbers: string[]): Promise<DOADChunk[]>
- formatChunksForLLM(chunks: DOADChunk[]): string
- getDOADMetadataByNumbers(doadNumbers: string[]): Promise<DOADMetadata[]>
```

**2.2.3 Metadata Selector Agent (`NEW: metadata-selector.ts`)**
```typescript
// Purpose: Second-phase LLM selection of relevant chunks
// Input: User query + all metadata for selected DOADs (as JSON string)
// Output: Selected chunk IDs for detailed analysis
// Model: Use READER_MODEL (lightweight, efficient)
```

**2.2.4 Main Handler Orchestration (`index.ts`)**
```typescript
// Updated workflow:
1. Finder Agent → DOAD numbers
2. Database Query → All chunks for DOADs  
3. Metadata Selector → Relevant chunk IDs
4. Database Query → Full content for selected chunks
5. Main Agent → Final synthesis
```

**2.2.5 Main Agent (`main.ts`)**
- **Minimal Changes** - Accept chunk-based content instead of full policies
- **Same Prompt Structure** - Maintain existing prompt format

### Phase 3: Database Operations Optimization

#### 3.1 Query Optimization Strategy
- **Batch Operations**: Single query to fetch all chunks for multiple DOADs
- **Metadata-First Query**: Fetch metadata separately for LLM selection
- **Index Utilization**: Leverage existing `doad_number` index
- **Connection Pooling**: Use Neon's pooled connections for CF Workers

#### 3.2 Cloudflare Workers Optimization
- **Push Compute to Database**: Complex filtering and aggregation via SQL
- **Minimize Round Trips**: Batch database operations
- **Leverage Wait Time**: CF doesn't charge for database wait time
- **Efficient Serialization**: Optimize JSON metadata handling

### Phase 4: Configuration and Environment

#### 4.1 Environment Variables
```bash
# .dev.vars (local development)
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require&channel_binding=require

# Wrangler secrets (production)
npx wrangler secret put DATABASE_URL
```

#### 4.2 Wrangler Configuration Updates
```toml
# wrangler.jsonc - Add database binding if needed
# Or use environment variable approach for maximum flexibility
```

### Phase 5: Testing and Validation

#### 5.1 Development Testing
- **Local Database**: Test with local Neon instance
- **Chunk Selection**: Validate metadata selector accuracy
- **Performance**: Measure database query times
- **Error Handling**: Test connection failures and retries

#### 5.2 Integration Testing
- **End-to-End Flow**: Complete user query → response cycle
- **Multiple DOADs**: Test queries spanning multiple policies
- **Edge Cases**: Empty results, connection timeouts
- **Backward Compatibility**: Ensure existing functionality preserved

## Implementation Priority

### High Priority (Week 1)
1. **Database Connection Setup** - Essential foundation
2. **Schema Definition** - Type safety and structure
3. **Basic Database Service** - Core CRUD operations
4. **Update drizzle.config.ts** - Switch to Postgres

### Medium Priority (Week 2)  
1. **Metadata Selector Agent** - New LLM component
2. **Handler Integration** - Orchestrate new flow
3. **Database Optimization** - Query performance
4. **Error Handling** - Robust failure management

### Low Priority (Week 3)
1. **Advanced Optimization** - Connection pooling, caching
2. **Monitoring and Logging** - Observability improvements
3. **Documentation Updates** - READMEs and prompts
4. **Testing Suite** - Comprehensive test coverage

## Success Criteria

### Technical Outcomes
- [ ] **Database Integration**: Successful Neon connection and queries
- [ ] **Two-Phase Selection**: Finder → DB → Metadata Selector → Main Agent
- [ ] **Performance**: Sub-second response times for typical queries
- [ ] **Reliability**: Graceful handling of database connectivity issues

### User Experience Outcomes  
- [ ] **Maintained Quality**: Response quality equals or exceeds current system
- [ ] **Improved Precision**: Better chunk selection reduces irrelevant content
- [ ] **Scalability**: System handles increased policy volume efficiently
- [ ] **Backward Compatibility**: No breaking changes to existing API

## Risk Mitigation

### Database Connectivity
- **Connection Pooling**: Use Neon's pooled connections
- **Retry Logic**: Implement exponential backoff for failed connections
- **Fallback Strategy**: Consider graceful degradation to existing R2 system

### Performance Concerns
- **Database Optimization**: Proper indexing and query optimization
- **Chunking Strategy**: Efficient metadata vs content separation  
- **Caching**: Consider edge caching for frequently accessed policies

### Migration Safety
- **Gradual Rollout**: Feature flags for progressive deployment
- **A/B Testing**: Compare new vs old system performance
- **Rollback Plan**: Quick revert to R2-based system if needed

## File Structure Changes

### New Files
```
src/lib/server/db/
├── schema.ts           # Drizzle schema definitions
├── client.ts           # Neon database client
└── types.ts           # Database-specific types

src/lib/services/policyFoo/doadFoo/
├── database.service.ts # Database operations
├── metadata-selector.ts# Second-phase LLM selection
└── prompts/
    └── metadata-selector.md # Prompt for chunk selection
```

### Modified Files
```
drizzle.config.ts       # Switch to Postgres dialect
package.json           # Add @neondatabase/serverless
src/lib/services/policyFoo/doadFoo/
├── index.ts           # Orchestrate new workflow
└── types.ts           # Add database-related types
```
