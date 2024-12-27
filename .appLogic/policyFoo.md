# PolicyFoo Base Handler
## Core Structure
### Frontend
- one fontend for all subFoo backends
- Top navigation bar
- Common UI elements
  - Rate limit display
  - Chat interface
  - Input controls
- Dropdown menu for policy group selection

### Base Agent Architecture
#### PolicyFooBase
- Core orchestration logic
- Rate limit handling
- Sends user messages and conversation history to the correct subFoo

---

# Policy-Specific Implementations
## DOAD Policy Tool (doadFoo.md)
> See detailed implementation in doadFoo.md

## Future Policy Types
- drmisFoo