# DOAD PolicyFoo Handler

## Purpose
LLM workflow for answering questions related to DOAD (Defence Operations and Activities Directives) policies with authoritative citations. Implements a sophisticated two-stage agent architecture for accurate policy identification and comprehensive response generation.

**See also**: [PolicyFoo Main Documentation](../README.md) | [LEAVE Handler](../leaveFoo/README.md)

## Overview
The DOAD handler processes policy queries through a sophisticated two-stage workflow:
1. **Stage 1**: Finder Agent identifies relevant DOAD policy numbers using lightweight model
2. **Stage 2**: Main Agent synthesizes policy content and generates structured responses

**Architecture Note**: This differs from the [LEAVE handler](../leaveFoo/README.md) which uses a single-stage workflow since all leave policies are in one document.

## Workflow
  1. Receives a user message from `policyFoo` Router as init. Or a continuation of a conversation ( `user` + `assistant` message sequence)
  2. Routes the message or conversation to `src/lib/services/policyFoo/doadFoo/finder.ts` 
  3. Receives the `assistant` message from finder.ts
    - The `assistant` message contains the DOAD policy numbers relevant to the user question
  4. Pulls the relevant DOAD policies from R2 bucket
    - Ref `src/lib/services/policyFoo/r2.util.ts` for implementation
    - Policies are in `Bucket: policies` file example `doad/1000-1.md`
    - All policies are in markdown format in the `doad` folder in the `policies` bucket
  5. Sends the user message or conversation to the `src/lib/services/policyFoo/doadFoo/main.ts`
  6. Receives the `assistant` message from `main.ts`
    - Adds the `assistant` message to the conversation end and updates the conversation history
  7. Sends the updated conversation to the `policyFoo` Router

## Implementation Details

### Core Components

#### 1. Handler Orchestration (`index.ts`)
- **Entry Point**: Main handler function `handleDOADQuery()`
- **Configuration Loading**: Loads prompts and AI model settings
- **Two-Stage Coordination**: Orchestrates finder → main agent workflow
- **Error Handling**: Comprehensive error handling with graceful degradation
- **Policy Retrieval**: Manages R2 bucket operations for policy content

#### 2. Finder Agent (`finder.ts`)
- **Purpose**: Identifies relevant DOAD policy numbers from user queries
- **Model**: Uses `READER_MODEL` (lightweight, fast identification)
- **Input**: User conversation + finder prompt + policy list table
- **Output**: Comma-separated policy numbers (max 5) or "none"
- **Parsing**: Handles various response formats and edge cases

#### 3. Main Agent (`main.ts`)
- **Purpose**: Synthesizes policy content and generates comprehensive responses
- **Model**: Uses `MAIN_MODEL` (capable synthesis and reasoning)
- **Input**: User conversation + main prompt + retrieved policy content
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
├── README.md              # This documentation
├── index.ts               # Handler orchestration
├── finder.ts              # Policy identification agent
├── main.ts                # Policy synthesis agent
└── prompts/               # LLM prompts
    ├── finder.md          # Finder agent instructions
    ├── main.md            # Main agent instructions
    └── DOAD-list-table.md # Available policies reference
```

#### R2 Bucket Structure
```
policies/                  # R2 bucket name
└── doad/                  # DOAD policies folder
    ├── 1000-1.md         # Individual policy files
    ├── 5017-1.md         # Leave policies
    ├── 7021-3.md         # Training policies
    └── ...               # Additional DOAD policies
```

### Agent Prompts

#### Finder Prompt (`prompts/finder.md`)
- **Objective**: Extract relevant policy numbers only
- **Format**: Comma-separated list or "none"
- **Constraints**: Maximum 5 policies, specific format requirements
- **Reference**: Uses DOAD list table for available policies

#### Main Prompt (`prompts/main.md`)
- **Objective**: Generate comprehensive policy responses
- **Format**: Structured XML with answer, citations, follow-up
- **Features**: Citation accuracy, follow-up question generation
- **Context**: Full policy content and conversation history

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

#### Main Agent Output
```typescript
{
  response: "<response><answer>...</answer><citations>...</citations><follow_up>...</follow_up></response>",
  usage: { prompt_tokens: 2500, completion_tokens: 400, total_tokens: 2900 }
}
```

#### Combined Handler Response
```typescript
{
  message: "Raw XML response from main agent",
  usage: {
    finder: { prompt_tokens: 150, completion_tokens: 12, total_tokens: 162 },
    main: { prompt_tokens: 2500, completion_tokens: 400, total_tokens: 2900 }
  }
}
```

### Error Handling

#### Policy Not Found
- **Scenario**: No policies match the user query
- **Response**: Generates helpful "no policies found" message
- **Features**: Suggests rephrasing, asks for more context
- **Fallback**: Graceful degradation without breaking conversation

#### Missing Policy Files
- **Scenario**: Policy numbers identified but files missing from R2
- **Behavior**: Continues with available policies, logs warnings
- **User Experience**: Partial responses better than complete failure
- **Recovery**: Clear indication of which policies couldn't be loaded

#### AI Service Failures
- **Retry Logic**: Built into AI Gateway service
- **Error Propagation**: Clear error messages to frontend
- **Logging**: Comprehensive error logging for debugging
- **Fallback**: Service degradation rather than complete failure

### Performance Characteristics

#### Token Efficiency
- **Finder Stage**: ~150-300 tokens per query (lightweight)
- **Main Stage**: ~2000-4000 tokens per query (comprehensive)
- **Total**: Optimized for cost while maintaining quality

#### Response Times
- **Finder Agent**: ~1-2 seconds (fast identification)
- **Policy Retrieval**: ~200-500ms (R2 bucket access)
- **Main Agent**: ~3-8 seconds (comprehensive synthesis)
- **Total**: ~5-12 seconds end-to-end

#### Scalability
- **Stateless**: No server-side storage requirements
- **Concurrent**: Handles multiple simultaneous requests
- **R2 Access**: Efficient policy file retrieval
- **Memory**: Minimal memory footprint per request

### Development Guidelines

#### Adding New Policies
1. Add policy file to R2 bucket: `doad/XXXX-X.md`
2. Update `DOAD-list-table.md` with policy details
3. Test finder agent can identify the new policy
4. Verify main agent can process policy content

#### Prompt Modifications
1. **Finder Prompt**: Focus on identification accuracy
2. **Main Prompt**: Emphasize citation quality and structure
3. **Testing**: Validate with diverse query types
4. **Versioning**: Document prompt changes for tracking

#### Error Scenarios Testing
- Missing policy files
- Malformed policy content
- AI service timeouts
- Invalid policy numbers
- Empty user queries

### Integration Points

#### With PolicyFoo Router
- **Input**: `PolicyQueryInput` with messages and policy set
- **Output**: `PolicyQueryOutput` with XML response and usage
- **Error Handling**: Throws `PolicyFooError` for Router to handle

#### With R2 Bucket
- **Read Access**: Policy file retrieval via `readPolicyFileAsText()`
- **Error Handling**: Graceful handling of missing files
- **Path Construction**: Automatic path building for policy files

#### With AI Gateway
- **Dual Models**: Separate services for finder and main agents
- **Configuration**: Independent model selection per agent
- **Usage Tracking**: Token usage for both stages

### Future Enhancements

#### Planned Features
- **Policy Versioning**: Handle multiple versions of same policy
- **Cross-References**: Link related policies automatically
- **Semantic Search**: Enhanced policy discovery beyond exact matches
- **Caching**: Policy content caching for improved performance

#### Architecture Evolution
- **Hybrid Approach**: Consider adopting LEAVE handler's single-stage approach for well-defined policy domains
- **Shared Components**: Extract common functionality with LEAVE handler into shared utilities
- **Performance Optimization**: Learn from LEAVE handler's simplified workflow for applicable scenarios

**See also**: [LEAVE Handler optimizations](../leaveFoo/README.md#performance-characteristics) for comparison