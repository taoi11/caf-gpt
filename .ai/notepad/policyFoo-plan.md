# PolicyFoo Module Implementation Plan

## Overview
The PolicyFoo module is an LLM-powered system for answering policy/regulation questions with authoritative citations. It follows a router-based architecture that directs queries to specialized policy-specific agents.

## Current Status
✅ **Prompts Ready**: All LLM agent prompts are set up and ready for implementation
✅ **Documentation**: Clear workflow and structure documented
🔄 **Implementation Needed**: Core TypeScript files need to be created

## Architecture Overview

### 1. Router Pattern (`src/lib/services/policyFoo/index.ts`)
- **Main entry point** for all policy queries
- **Validates** `policy_set` parameter from frontend
- **Routes** to appropriate policy-specific handlers
- **Supports** conversation continuity (multi-turn chats)

### 2. Policy-Specific Handlers
Each policy set has its own specialized handler:
- **doadFoo** (`src/lib/services/policyFoo/doadFoo/index.ts`) - DOAD policies ✅ Ready
- **leaveFoo** (`src/lib/services/policyFoo/leaveFoo/index.ts`) - Leave policies 🔄 Future

### 3. Two-Stage Agent Workflow (per policy set)

#### Stage 1: Policy Finder Agent
- **Purpose**: Identify relevant policy numbers from user query
- **Input**: User message + conversation history
- **Output**: Comma-separated policy numbers (max 5) or "none"
- **Prompt**: `src/lib/services/policyFoo/doadFoo/prompts/finder.md` ✅
- **Reference**: `src/lib/services/policyFoo/doadFoo/prompts/DOAD-list-table.md` ✅

#### Stage 2: Main Chat Agent  
- **Purpose**: Synthesize policy content and provide answers with citations
- **Input**: User message + conversation + retrieved policy content
- **Output**: Structured XML response with answer, citations, follow-up
- **Prompt**: `src/lib/services/policyFoo/doadFoo/prompts/main.md` ✅

## Data Flow

```
Frontend Request (user message + policy_set)
    ↓
Router (validates policy_set)
    ↓
Policy Handler (e.g., doadFoo)
    ↓
Finder Agent → Policy Numbers
    ↓
R2 Bucket → Policy Content (doad/XXXX-X.md)
    ↓
Main Agent → Structured Response
    ↓
Router → Frontend
```

## Implementation Plan

### Phase 1: Core Infrastructure
1. **Create Types** (`src/lib/services/policyFoo/types.ts`)
   - Message interfaces (user, assistant, system)
   - Policy set enumeration
   - Configuration interfaces
   - Error types

2. **Create AI Gateway Service** (`src/lib/services/policyFoo/ai-gateway.service.ts`)
   - Independent OpenRouter integration
   - Support for multiple models (READER_MODEL, MAIN_MODEL)
   - AI Gateway configuration
   - Error handling and retry logic
   - No dependencies on paceNote

3. **Create R2 Utilities** (`src/lib/services/policyFoo/r2.util.ts`)
   - Policy file retrieval from R2 bucket
   - Error handling for missing files
   - Independent implementation

4. **Create Router** (`src/lib/services/policyFoo/index.ts`)
   - Policy set validation
   - Routing logic to policy handlers
   - **Stateless request processing** (no conversation storage)
   - Error handling

5. **Create doadFoo Handler** (`src/lib/services/policyFoo/doadFoo/index.ts`)
   - Two-stage agent orchestration
   - R2 integration for policy retrieval
   - Prompt template loading
   - Response formatting

### Phase 2: Agent Implementation
6. **Create Finder Service** (`src/lib/services/policyFoo/doadFoo/finder.ts`)
   - Load finder prompt template
   - Use READER_MODEL for policy identification
   - Integrate with policyFoo AI Gateway
   - Parse policy number responses
   - Handle "none" responses

7. **Create Main Service** (`src/lib/services/policyFoo/doadFoo/main.ts`)
   - Load main prompt template
   - Use MAIN_MODEL for policy synthesis
   - Integrate with policyFoo AI Gateway
   - Handle XML response parsing
   - Validate citation format

### Phase 3: Integration
6. **R2 Integration** (create `src/lib/services/policyFoo/r2.util.ts`)
   - Policy content retrieval from `policies` bucket
   - File path construction (`doad/XXXX-X.md`)
   - Error handling for missing policies
   - Independent implementation (no paceNote dependencies)

7. **AI Gateway Service** (create `src/lib/services/policyFoo/ai-gateway.util.ts`)
   - Independent AI Gateway integration
   - OpenRouter provider support
   - Multi-model support (READER_MODEL, MAIN_MODEL)
   - Error handling and retry logic
   - Configuration management

8. **Frontend Integration**
   - API endpoint creation
   - Form handling with policy_set dropdown
   - **Client-side conversation state management**
   - **Browser-based chat history** (session persistence)
   - Response display with citations
   - **No server-side conversation storage**

## Configuration Requirements

### Environment Variables
- `OPENROUTER_TOKEN` - AI provider authentication
- `AI_GATEWAY_BASE_URL` - Cloudflare AI Gateway endpoint  
- `READER_MODEL` - LLM model for the Finder Agent (policy identification)
- `MAIN_MODEL` - LLM model for the Main Agent (policy synthesis and response)
- `CF_AIG_TOKEN` - AI Gateway authorization

### Model Configuration Strategy

#### Two-Stage Model Usage
- **READER_MODEL**: Optimized for policy identification and extraction
  - Used by Finder Agent to identify relevant policy numbers
  - Typically faster, lighter models for quick analysis
  - Examples: `openai/gpt-3.5-turbo`, `anthropic/claude-3-haiku`

- **MAIN_MODEL**: Optimized for synthesis and comprehensive responses  
  - Used by Main Agent for detailed policy analysis and citation
  - Typically more capable models for complex reasoning
  - Examples: `openai/gpt-4`, `anthropic/claude-3-5-sonnet`

#### Benefits of Separate Models
- **Cost Optimization**: Use lighter models for simple tasks
- **Performance Tuning**: Match model capabilities to task complexity
- **Flexibility**: Independent model selection per agent
- **Scalability**: Different rate limits and pricing per model

### Cloudflare Bindings
- `POLICIES` - R2 bucket containing policy documents
- `AI` - Cloudflare AI Gateway service for LLM requests

## File Structure (Implementation Target)

```
policyFoo/
├── README.md                    ✅ Done
├── types.ts                     🔄 To Create
├── index.ts                     🔄 To Create (Router)
├── constants.ts                 🔄 To Create
├── ai-gateway.util.ts           🔄 To Create (Independent AI Gateway)
├── r2.util.ts                   🔄 To Create (Independent R2 utilities)
├── doadFoo/
│   ├── README.md               ✅ Done
│   ├── index.ts                🔄 To Create (Handler)
│   ├── finder.ts               🔄 To Create (Finder Agent)
│   ├── main.ts                 🔄 To Create (Main Agent)
│   └── prompts/
│       ├── finder.md           ✅ Done
│       ├── main.md             ✅ Done
│       └── DOAD-list-table.md  ✅ Done
└── leaveFoo/                   📋 Future Implementation
    ├── index.ts                🔄 Future
    ├── finder.ts               🔄 Future
    ├── main.ts                 🔄 Future
    └── prompts/                🔄 Future
```

## Key Design Principles

### 1. Co-location & Independence
- Related functionality grouped together
- Policy-specific logic isolated in submodules
- Prompts stored with their consuming agents
- **Complete independence from paceNote module**
- **Self-contained AI Gateway and R2 utilities**

### 2. Modular Design
- Clear separation between router and handlers
- Reusable agent pattern across policy sets
- Standardized interfaces for extensibility

### 3. Error Resilience
- Graceful handling of missing policies
- Fallback responses for agent failures
- Clear error messages for debugging

### 4. Conversation Support
- **Stateless server design** - No server-side conversation storage
- **Client-side conversation management** - Browser maintains chat history
- **Session-based persistence** - History lost on page refresh/session change
- **Multi-turn context passing** - Frontend sends full conversation to server
- **Follow-up question generation** - Assists user with next queries

## Module Independence Requirements

### ❌ No Cross-Dependencies with PaceNote
- **AI Gateway**: PolicyFoo must implement its own AI Gateway service
- **R2 Utilities**: PolicyFoo must implement its own R2 file handling
- **Types**: PolicyFoo must define its own types and interfaces
- **Constants**: PolicyFoo must define its own configuration constants

### ✅ Self-Contained Module
- Complete independence allows parallel development
- Each module can evolve independently
- Clear separation of concerns between domains
- No shared state or dependencies between services

### 🔧 Implementation Strategy
- Study paceNote patterns but implement independently
- Adapt proven patterns to policy-specific needs
- Maintain consistent code quality and architecture
- Follow established project conventions

## Serverless Architecture Considerations

### Stateless Design Benefits
- **Cost Efficiency**: No persistent storage costs for conversations
- **Scalability**: Each request is independent and can scale infinitely
- **Simplicity**: No session management or cleanup required
- **Performance**: No database lookups for conversation state

### Client-Side Conversation Management
- **Browser Storage**: Conversation history stored in browser memory/localStorage
- **Request Payload**: Full conversation sent with each request
- **Session Scope**: History persists only during browser session
- **Privacy**: No conversation data stored on servers

### Request/Response Pattern
```
Frontend → Backend Request:
{
  messages: [
    { role: "user", content: "What is DOAD 5001?" },
    { role: "assistant", content: "..." },
    { role: "user", content: "What about section 3?" }
  ],
  policy_set: "DOAD"
}

Backend → Frontend Response:
{
  role: "assistant",
  content: "...",
  citations: ["DOAD 5001-1: Section 3.1, 3.2"],
  follow_up: "Would you like details on section 3.3?"
}
```

## Future Extensions

### Additional Policy Sets
- Leave policies (leaveFoo)
- Safety policies (safetyFoo)
- Training policies (trainingFoo)
