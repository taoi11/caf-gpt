# Policy-Foo Tool Overview
## Frontend
### Layout
- Top navigation bar
- Conversation panel (75% width)
  - Rate limit display (top-right, floating)
    - Hourly remaining
    - Daily remaining
  - Chat history
    - Session retention
    - Max 5 messages
    - User messages (gray background, editable)
    - AI responses (white background)
      - Answer
      - Citations
      - Follow-up
  - Input area (expandable)
  - Send button (streaming disabled)
## Backend
### Base Agent Structure
#### BaseAgent
- Simple logic to orchestrate the child agents
- Handles flow of info between child agents
- Paasses the llmGateway connection to the child agents
- Handles the rate limit
  - Checks if the rate limit is not exceeded before starting logic
#### Child Agents
1. **Finder Agent**
  - Main purpose: Policy identification
  - Inherits from BaseAgent
    - user message or conversation history if not first message
    - LLM connection
  - system prompt
    - base: src/prompts/paceNote/policyFinder.md
    - DOAD List: src/prompts/paceNote/DOAD-list-table.md
2. **Reader Agent**
  - Main purpose: Content extraction
  - Inherits from BaseAgent
    - policy or documentation full text
    - user message
    - LLM connection
  - system prompt
    - base: src/prompts/paceNote/policyReader.md
    - Policy or documentation full text from Finder Agent

3. **Chat Agent**
   - Inherits from: BaseAgent
   - Main purpose: User interaction
   - Key method: chat()

## Data Types
- PolicyAgentOptions
- PolicyReference
- PolicyContent
- ChatResponse
- Message

## Monitoring
- Privacy-focused logging
- No logging of:
  - User messages
  - Personal information
  - Session data

## API Endpoint
`POST /llm/policyfoo/generate`
- Parameters:
  - content (string)
  - conversation_history (optional)
  - options (optional)
- Response: Streaming text