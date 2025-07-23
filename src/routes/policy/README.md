# Policy Route

> **🤖 AI Agent Navigation** | **Domain**: Policy Q&A UI | **Integration**: `$lib/modules/policyFoo`

## 🔍 Quick Reference

**Integration Point**: `$lib/modules/policyFoo` → Router with DOAD/LEAVE handlers  
**Server Logic**: `+page.server.ts` → Chat message processing and handler calls  
**UI Flow**: Chat interface → Policy set selection → Message processing → XML response parsing  
**Key Components**: `PolicyComponents/` with specialized chat UI elements

**Files to Understand**:

1. `+page.svelte` - Main chat interface orchestration
2. `+page.server.ts` - Server actions and message handling
3. `PolicyComponents/MessageList.svelte` - Chat message display
4. `PolicyComponents/PolicySelector.svelte` - DOAD/LEAVE policy set picker
5. `PolicyComponents/ResponseParser.svelte` - XML response parsing and display

## Purpose

Chat-based UI for policy question answering with support for multiple policy sets (DOAD, LEAVE). Handles conversation flow, policy set switching, and structured response display with citations.

## Directory Structure

```
policy/
├── README.md              # This documentation
├── +page.svelte          # Main policy chat interface
├── +page.server.ts       # Server-side logic and actions
└── PolicyComponents/     # Reusable UI components
    ├── CitationRenderer.svelte    # Displays policy citations
    ├── MessageList.svelte         # Chat message display
    ├── PolicySelector.svelte      # DOAD/LEAVE selection dropdown
    └── ResponseParser.svelte      # XML response parsing and rendering
```

## 🔄 Integration Points

### With PolicyFoo Module (`$lib/modules/policyFoo`)

- **Service Import**: `processPolicyQuery()` function for chat message processing
- **Handler Routing**: Automatic routing to DOAD or LEAVE handlers based on policy_set
- **Response Format**: Receives XML responses for frontend parsing
- **Error Handling**: Unified error handling from module layer

### With UI Components

- **Message Flow**: User input → Server action → Module processing → Component display
- **Policy Switching**: Real-time policy set changes during conversations
- **Citation Display**: Structured rendering of policy references and sources
- **Progressive Enhancement**: Works with and without JavaScript enabled

### With Server Actions

- **Form Processing**: Chat message submission via SvelteKit form actions
- **State Management**: Conversation history maintained in browser state
- **Validation**: Input validation and sanitization before module processing

## Key Features

### Chat Interface

- **Conversation Flow**: Maintains full conversation history for context
- **Policy Set Switching**: Users can switch between DOAD and LEAVE mid-conversation
- **Real-time Responses**: Progressive enhancement with immediate feedback
- **Message History**: Browser-based conversation persistence

### XML Response Parsing

- **Citation Rendering**: Structured display of policy references
- **Answer Formatting**: Clean presentation of policy answers
- **Follow-up Suggestions**: Interactive follow-up question display
- **Error Handling**: Graceful handling of malformed responses

### Policy Set Management

- **Dynamic Selection**: Dropdown allows real-time policy set switching
- **Context Preservation**: Conversation context maintained across policy changes
- **Handler Coordination**: Seamless integration with multiple policy handlers

## Development

### Adding New Policy Sets

1. Update `PolicySelector.svelte` with new policy set option
2. Ensure policy handler exists in `$lib/modules/policyFoo`
3. Test policy set switching functionality
4. Update documentation with new policy set details

### UI Component Development

- **Co-location**: Policy-specific components live in `PolicyComponents/`
- **Reusability**: Components designed for extension and modification
- **Type Safety**: Full TypeScript integration with module types
- **Testing**: Component-level testing alongside route-level tests

### Response Format Handling

- **XML Structure**: Components expect structured XML from policy handlers
- **Error Boundaries**: Graceful handling of parsing failures
- **Content Security**: Proper sanitization of policy content display
- **Accessibility**: Screen reader and keyboard navigation support
