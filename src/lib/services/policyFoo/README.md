# PolicyFoo Service

## Purpose
LLM-powered service for answering policy/regulation questions with authoritative citations. Provides a router-based architecture that directs queries to specialized policy-specific agents for accurate, contextual responses.

## Overview
PolicyFoo implements a stateless, router-based architecture that directs queries to specialized policy-specific handlers:

### Handler Architecture
- **DOAD Handler** (`doadFoo/`) - Two-stage workflow (finder → main agent)
- **LEAVE Handler** (`leaveFoo/`) - Single-stage workflow (main agent only)
- **Router** (`index.ts`) - Validates input and routes to appropriate handler

### Key Design Principles
- **Stateless**: No server-side conversation storage
- **Context Passing**: Full conversation history sent with each request
- **Scalable**: Each request is independent and can scale infinitely
- **Cost Efficient**: Model selection optimized for each task type

## Workflow
1. **User Query**: User sends question + `policy_set` parameter from frontend
2. **Router Validation**: Router validates input and policy set (`DOAD` or `LEAVE`)
3. **Handler Selection**: Router routes to appropriate policy handler:
   - `DOAD` → `doadFoo/` (two-stage: finder → main)
   - `LEAVE` → `leaveFoo/` (single-stage: main only)
4. **Policy Processing**: Handler processes query using appropriate workflow
5. **Response Generation**: Handler returns structured XML response with citations
6. **Frontend Integration**: Frontend parses XML and displays interactive results

### Conversation Flow
- **Stateless Design**: Each request includes full conversation history
- **Policy Set Switching**: Users can switch between DOAD/LEAVE mid-conversation
- **Context Preservation**: Previous conversation context maintained across policy set changes

## Architecture

### Handler Comparison
| Feature | DOAD Handler | LEAVE Handler |
|---------|--------------|---------------|
| **Workflow** | Two-stage (finder → main) | Single-stage (main only) |
| **Policy Storage** | Multiple files (`doad/*.md`) | Single file (`leave/leave_policy_2025.md`) |
| **Models Used** | READER_MODEL + MAIN_MODEL | MAIN_MODEL only |
| **Token Efficiency** | ~2500-4500 per query | ~2000-3000 per query |
| **Response Time** | ~5-12 seconds | ~3-7 seconds |
| **Cost** | Higher (two AI calls) | Lower (~40% savings) |

### Shared Infrastructure
- **AI Gateway Integration**: Both handlers use the same AI Gateway service
- **R2 Storage**: Common R2 bucket with organized folder structure
- **Error Handling**: Unified error types and handling patterns
- **Response Format**: Both return identical XML structure for frontend parsing

## Implementation Details

### Core Files
- **`index.ts`** - Main router with validation and policy set routing
- **`types.ts`** - Complete TypeScript type definitions
- **`constants.ts`** - Configuration constants and error messages
- **`ai-gateway.util.ts`** - Independent AI Gateway service
- **`r2.util.ts`** - R2 bucket utilities for policy retrieval

### Environment Variables
```bash
OPENROUTER_TOKEN=your_openrouter_token
AI_GATEWAY_BASE_URL=https://your-ai-gateway-url
CF_AIG_TOKEN=your_caf_aig_token
READER_MODEL=anthropic/claude-3-haiku  # Optional
MAIN_MODEL=anthropic/claude-3-5-sonnet # Optional
```

### Cloudflare Bindings
- **POLICIES** - R2 bucket containing policy documents

### Usage Example
```typescript
import { processPolicyQuery } from '$lib/services/policyFoo';

const result = await processPolicyQuery({
  messages: [
    { role: 'user', content: 'What are leave approval requirements?', timestamp: Date.now() }
  ],
  policy_set: 'DOAD'
}, env);

// Returns: { message: '<xml_response>', usage: { finder: {...}, main: {...} } }
```

### Response Format
The service returns raw XML responses that the frontend parses:
```xml
<response>
  <answer>Policy-based answer with detailed information...</answer>
  <citations>
    <citation>DOAD 5017-1: Leave Policy</citation>
  </citations>
  <follow_up>Would you like to know about specific types of leave?</follow_up>
</response>
```

### Frontend Integration
- **SvelteKit Route**: `/policy` with server actions
- **Progressive Enhancement**: Works without JavaScript
- **Client-Side Parsing**: Frontend extracts structured data from XML
- **Interactive Citations**: Clickable policy references
- **Follow-up Questions**: Suggested queries for conversation flow

## Directory Structure
```
policyFoo/
├── README.md                    # This file - High-level architecture
├── index.ts                     # Main router and entry point
├── types.ts                     # TypeScript type definitions
├── constants.ts                 # Configuration and constants
├── ai-gateway.util.ts           # AI Gateway service
├── r2.util.ts                   # R2 bucket utilities
├── example-usage.ts             # Usage examples
├── doadFoo/                     # DOAD policy handler
│   ├── README.md               # DOAD-specific implementation details
│   ├── index.ts                # DOAD handler orchestration
│   ├── finder.ts               # Policy identification agent
│   ├── main.ts                 # Policy synthesis agent
│   └── prompts/                # LLM prompts
│       ├── main.md             # Main agent prompt
│       ├── finder.md           # Finder agent prompt
│       └── DOAD-list-table.md  # Available policies reference
└── leaveFoo/                   # Leave policy handler
    ├── README.md               # LEAVE-specific implementation details
    ├── index.ts                # LEAVE handler orchestration
    ├── main.ts                 # Policy processing agent
    ├── example-usage.ts        # LEAVE-specific examples
    └── prompts/                # LLM prompts
        └── main.md             # Main agent prompt
```

## Policy Sets

### DOAD (Defence Administrative Orders and Directives)
- **Status**: ✅ Production Ready
- **Handler**: `doadFoo/` → [Implementation Details](./doadFoo/README.md)
- **Policies**: Multiple documents in R2 bucket at `doad/*.md`
- **Workflow**: Two-stage (finder identifies policies → main synthesizes response)
- **Use Cases**: Operational directives, training policies, administrative procedures

### LEAVE (Leave Policies)  
- **Status**: ✅ Production Ready
- **Handler**: `leaveFoo/` → [Implementation Details](./leaveFoo/README.md)
- **Policies**: Single comprehensive document at `leave/leave_policy_2025.md`
- **Workflow**: Single-stage (main agent processes leave policy directly)
- **Use Cases**: Annual leave, sick leave, compassionate leave, parental leave

## Error Codes
- `INVALID_POLICY_SET` - Unknown or unsupported policy set
- `INVALID_MESSAGES` - Malformed message array
- `MESSAGES_EMPTY` - No messages provided
- `POLICY_NOT_FOUND` - Requested policy doesn't exist
- `POLICY_FILE_NOT_FOUND` - Policy file missing from R2
- `PROMPT_NOT_FOUND` - Required prompt file missing
- `AI_GATEWAY_ERROR` - AI service communication failure
- `R2_ERROR` - R2 bucket operation failure
- `PARSING_ERROR` - Response parsing failure
- `GENERAL_ERROR` - Unexpected error

## Getting Started

### For Developers
1. **Read Handler Documentation**: 
   - [DOAD Handler Details](./doadFoo/README.md) - Two-stage workflow implementation
   - [LEAVE Handler Details](./leaveFoo/README.md) - Single-stage workflow implementation
2. **Review Usage Examples**: Check `example-usage.ts` and handler-specific examples
3. **Understand Types**: Study `types.ts` for interface contracts
4. **Test Integration**: Use existing test patterns to validate new handlers

### For Users  
1. **Visit `/policy` page** in the web interface
2. **Select policy set** from dropdown (DOAD or LEAVE)
3. **Ask questions** - get responses with authoritative citations
4. **Switch policy sets** anytime during conversation
5. **Follow citations** for detailed policy references

### For Operators
1. **Monitor Usage**: Track token usage and costs per policy set
2. **Update Policies**: Upload new/updated policy documents to R2 bucket
3. **Performance Monitoring**: Compare response times between handlers
4. **Error Tracking**: Monitor policy retrieval and AI service errors

## Development Notes

### Design Philosophy
- **Co-location**: Related functionality grouped together by policy set
- **Independent Modules**: Each handler can be developed and tested independently  
- **Consistent Interfaces**: All handlers implement the same input/output contracts
- **Extensible**: Easy to add new policy sets following established patterns

### Adding New Policy Sets
1. Create new handler directory (e.g., `newPolicyFoo/`)
2. Implement handler following `PolicyQueryInput` → `PolicyQueryOutput` contract
3. Add policy set to `POLICY_SETS` constant
4. Update router switch statement in `index.ts`
5. Add R2 bucket path configuration
6. Update frontend policy selector

### Testing Strategy
- **Unit Tests**: Test individual handler functions in isolation
- **Integration Tests**: Test end-to-end workflows with mock data
- **Handler-Specific Tests**: Each handler has its own test suite
- **Shared Utilities**: Common test fixtures and utilities in parent directory