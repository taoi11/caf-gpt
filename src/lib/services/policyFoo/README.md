# PolicyFoo Service

## Purpose
LLM-powered service for answering policy/regulation questions with authoritative citations. Provides a router-based architecture that directs queries to specialized policy-specific agents for accurate, contextual responses.

## Overview
PolicyFoo implements a stateless, two-stage agent workflow:
1. **Finder Agent** - Identifies relevant policy numbers using a lighter LLM model
2. **Main Agent** - Synthesizes policy content and generates comprehensive responses with citations

## Workflow
   1. User sends a question + `policy_set` parameter from the frontend
    - Policy set is from a drop down menu from the frontend, only `DOAD` and `leave policy` are available
   2. Router receives the `user` message only as its the first message
    - Router is the main entry point of this module `src/lib/services/policyFoo/index.ts`
   3. Router validates the `policy_set` parameter
   4. Router selects the appropriate `<policy_set>_foo` based on the `policy_set` and sends the `user` message to the `<policy_set>_foo`
    - `doadFoo` is the only implemented policy set at the moment `src/lib/services/policyFoo/doadFoo/index.ts`
    - `leaveFoo` is planned for future implementation
   5. Router receives the `assistant` message from the `<policy_set>_foo`
   6. Router sends the `assistant` message to the frontend
   7. User sends a follow-up question + `policy_set` parameter from the frontend
   8. Router receives the `user` + `assistant` message sequence from the frontend
      - Accounts for long running conversations
   9. Router validates the `policy_set` parameter
   10. Router selects the appropriate `<policy_set>_foo` based on the `policy_set` and sends the `user` + `assistant` message sequence to the `<policy_set>_foo`
   ...

## Architecture

### Stateless Design
- **No Server-Side Storage**: Conversations are managed client-side
- **Context Passing**: Full conversation history sent with each request
- **Scalable**: Each request is independent and can scale infinitely
- **Cost Efficient**: No persistent storage costs

### Multi-Model Strategy
- **READER_MODEL**: Lightweight model for policy identification (default: `anthropic/claude-3-haiku`)
- **MAIN_MODEL**: Capable model for synthesis and responses (default: `anthropic/claude-3-5-sonnet`)

### Error Handling
- Comprehensive input validation
- Graceful handling of missing policies
- Fallback responses for AI service failures
- Typed error responses with actionable messages

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
├── README.md                    # This file
├── index.ts                     # Main router and entry point
├── types.ts                     # TypeScript type definitions
├── constants.ts                 # Configuration and constants
├── ai-gateway.util.ts           # AI Gateway service
├── r2.util.ts                   # R2 bucket utilities
├── example-usage.ts             # Usage examples
├── doadFoo/                     # DOAD policy handler
│   ├── README.md               # DOAD-specific documentation
│   ├── index.ts                # DOAD handler orchestration
│   ├── finder.ts               # Policy identification agent
│   ├── main.ts                 # Policy synthesis agent
│   └── prompts/                # LLM prompts
│       ├── main.md             # Main agent prompt
│       ├── finder.md           # Finder agent prompt
│       └── DOAD-list-table.md  # Available policies reference
└── leaveFoo/                   # Future: Leave policy handler
    └── README.md               # Placeholder for future implementation
```

## Policy Sets

### DOAD (Defence Operations and Activities Directives)
- **Status**: ✅ Implemented
- **Handler**: `doadFoo/`  
- **Policies**: Stored in R2 bucket at `doad/*.md`
- **Features**: Two-stage agent workflow, citation extraction, policy linking

### LEAVE (Leave Policies)
- **Status**: ✅ Implemented
- **Handler**: `leaveFoo/`
- **Policies**: Stored in R2 bucket at `leave/leave_policy_2025.md`
- **Features**: Single-stage workflow, citation extraction, policy guidance

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

## Performance Characteristics
- **Cold Start Optimized**: Minimal initialization overhead
- **Token Efficient**: Uses appropriate models for each task
- **Concurrent Safe**: Stateless design supports concurrent requests
- **Memory Efficient**: No server-side conversation storage

## Development Notes
- **Independent Module**: No dependencies on paceNote or other services
- **Co-located**: Related functionality grouped together
- **Type Safe**: Full TypeScript coverage
- **Testable**: Clear separation of concerns for unit testing
- **Extensible**: Easy to add new policy sets following the established pattern