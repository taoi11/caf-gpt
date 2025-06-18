# LEAVE PolicyFoo Handler

## Purpose
Simplified LLM workflow for answering questions related to CAF Leave policies. Unlike DOAD policies, this handler uses a single-stage architecture since all leave information is contained in one comprehensive document.

## Overview
The LEAVE handler processes policy queries through a streamlined single-stage workflow:
1. **Single Stage**: Main Agent retrieves the leave policy document and generates structured responses
2. **No Finder Needed**: All leave policies are in one document, no policy identification required

## Workflow
1. Receives a user message from `policyFoo` Router (initial query or conversation continuation)
2. Retrieves the single leave policy document from R2 bucket (`leave/leave_policy_2025.md`)
3. Sends user message/conversation + leave policy content to the main agent
4. Receives structured XML response from main agent
5. Returns response to `policyFoo` Router

## PolicyFoo Web Integration

### Seamless Policy Set Switching
- **Single Interface**: Users interact through the same `/policy` web page
- **Policy Set Selector**: Dropdown allows switching between `DOAD` and `LEAVE` policy sets
- **Conversation Continuity**: Users can switch policy sets mid-conversation while maintaining context
- **Stateless Design**: Each request includes full conversation history, enabling policy set changes

### User Experience Flow
1. User visits `/policy` page with unified interface
2. Selects policy set from dropdown (`DOAD` or `LEAVE`)
3. Asks policy questions - responses come from selected policy set
4. Can switch policy sets at any time during conversation
5. Previous conversation context maintained when switching
6. Each message clearly indicates which policy set was used

### Frontend Integration Points
- **Same UI Components**: Reuses existing PolicyFoo frontend components
- **Policy Set Parameter**: `policy_set: 'LEAVE'` sent with each request
- **Response Parsing**: Same XML parsing logic handles LEAVE responses
- **Citation Rendering**: Leave policy citations rendered consistently with DOAD

## Architecture Differences from DOAD

### Simplified Design
- **Single Document**: All leave policies consolidated in one file
- **No Finder Agent**: Direct document retrieval, no policy identification needed  
- **Single LLM Call**: Only uses `MAIN_MODEL` for response generation
- **Faster Response**: Eliminates finder stage, reducing latency and cost

### File Structure
```
leaveFoo/
├── README.md              # This documentation
├── index.ts               # Handler orchestration (simplified)
├── main.ts                # Policy processing agent
└── prompts/               # LLM prompts
    └── main.md            # Main agent instructions
```

### R2 Bucket Structure
```
policies/                  # R2 bucket name
└── leave/                 # Leave policies folder
    └── leave_policy_2025.md    # Single comprehensive leave policy document
```

## Implementation Plan

### Core Components

#### 1. Handler Orchestration (`index.ts`)
- **Entry Point**: Main handler function `handleLeaveQuery()`
- **Simple Flow**: User query → retrieve document → generate response
- **Error Handling**: Graceful handling of missing document or AI failures
- **Policy Retrieval**: Single R2 operation to get leave policy content

#### 2. Main Agent (`main.ts`)
- **Purpose**: Process leave policy content and generate comprehensive responses
- **Model**: Uses `MAIN_MODEL` (same as DOAD main agent)
- **Input**: User conversation + main prompt + leave policy document
- **Output**: Structured XML response with answer, citations, follow-up
- **Format**: Returns raw XML for frontend parsing (consistent with DOAD)

### Configuration

#### Models Used
- **MAIN_MODEL**: `anthropic/claude-3-5-sonnet` (default)
  - Same model as DOAD for consistency
  - Advanced reasoning for policy synthesis
  - Citation accuracy and context understanding

#### Expected Response Structure
```typescript
{
  message: "Raw XML response from main agent",
  usage: {
    main: { prompt_tokens: 2000, completion_tokens: 400, total_tokens: 2400 }
  }
}
```

### Agent Prompts

#### Main Prompt (`prompts/main.md`)
- **Objective**: Generate comprehensive leave policy responses
- **Format**: Structured XML with answer, citations, follow-up
- **Features**: Citation accuracy, follow-up question generation
- **Context**: Full leave policy document and conversation history
- **Specialization**: Focus on leave-specific scenarios (approval, types, calculations, etc.)

### Performance Characteristics

#### Token Efficiency
- **Single Stage**: ~2000-3000 tokens per query
- **Cost Savings**: ~40% reduction compared to DOAD (no finder stage)
- **Consistent Quality**: Same main model ensures response quality

#### Response Times
- **Document Retrieval**: ~200-300ms (single R2 operation)
- **Main Agent**: ~3-6 seconds (comprehensive synthesis)
- **Total**: ~3-7 seconds end-to-end (faster than DOAD)

#### Scalability
- **Stateless**: Same stateless design as DOAD
- **Concurrent**: Handles multiple simultaneous requests
- **Simpler R2 Access**: Single document retrieval per request
- **Lower Memory**: Reduced complexity and memory footprint

### Integration Points

#### With PolicyFoo Router
- **Input**: `PolicyQueryInput` with messages and `policy_set: 'LEAVE'`
- **Output**: `PolicyQueryOutput` with XML response and usage
- **Error Handling**: Throws `PolicyFooError` for Router to handle
- **Consistency**: Same interface as DOAD handler

#### With R2 Bucket
- **Read Access**: Single policy file retrieval `leave/leave_policy_2025.md`
- **Error Handling**: Graceful handling of missing file
- **Path Construction**: Simple path: `leave/leave_policy_2025.md`

#### With AI Gateway
- **Single Model**: Only uses `MAIN_MODEL` service
- **Configuration**: Inherits same AI Gateway configuration
- **Usage Tracking**: Simplified usage tracking (main stage only)

### Development Tasks

#### Phase 1: Core Implementation
- [ ] Create `index.ts` with simplified handler orchestration
- [ ] Implement `main.ts` agent for leave policy processing
- [ ] Create `prompts/main.md` with leave-specific instructions
- [ ] Add leave policy document to R2 bucket (`leave/leave_policy_2025.md`)

#### Phase 2: Integration & Testing
- [ ] Update `policyFoo/index.ts` router to support `LEAVE` policy set
- [ ] Test end-to-end workflow with sample leave questions
- [ ] Validate XML response parsing in frontend
- [ ] Test policy set switching functionality in web interface
- [ ] Add error handling for missing document scenarios

#### Phase 3: Documentation & Optimization
- [ ] Update main PolicyFoo README with LEAVE implementation status
- [ ] Add usage examples and common leave policy queries
- [ ] Performance testing and optimization
- [ ] Integration testing with existing PolicyFoo web interface

### Error Handling

#### Document Not Found
- **Scenario**: Leave policy document missing from R2 (`leave/leave_policy_2025.md`)
- **Response**: Clear error message indicating system issue
- **Recovery**: Fallback message suggesting user contact support
- **Logging**: Error logging for ops team notification

#### AI Service Failures
- **Retry Logic**: Same retry logic as DOAD implementation
- **Error Propagation**: Clear error messages to frontend
- **Fallback**: Service degradation message
- **Consistency**: Same error handling patterns as DOAD

### Future Enhancements

#### Potential Features
- **Document Versioning**: Handle updates to leave policy document
- **Section Linking**: Link to specific sections of leave policy
- **Calculator Integration**: Leave calculation tools and examples
- **Quick References**: Common leave scenarios and answers

#### Optimization Opportunities
- **Document Caching**: Cache leave policy document for faster access
- **Response Caching**: Cache common leave policy responses
- **Progressive Loading**: Load document sections as needed
- **Semantic Chunking**: Break large document into semantic chunks

## Getting Started

1. **Create Core Files**: Implement `index.ts`, `main.ts`, and `prompts/main.md`
2. **Add Policy Document**: Upload comprehensive leave policy to R2 bucket (`leave/leave_policy_2025.md`)
3. **Update Router**: Add LEAVE support to main PolicyFoo router
4. **Test Integration**: Validate with sample leave policy questions
5. **Test Web Interface**: Verify policy set switching works in `/policy` page
6. **Deploy**: Test in staging environment before production

## Notes

- **Simplicity**: This handler intentionally simpler than DOAD for faster development
- **Consistency**: Maintains same interfaces and patterns for easy maintenance  
- **Web Integration**: Seamlessly integrates with existing PolicyFoo web interface
- **Policy Set Switching**: Users can switch between DOAD and LEAVE mid-conversation
- **Extensibility**: Can be enhanced later if leave policies become more complex
- **Performance**: Optimized for speed and cost efficiency compared to DOAD workflow
