# PolicyFoo Base Handler

## Core Structure
### Frontend
- One frontend for all subFoo backends
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
- Consistent error handling across all endpoints

### Rate Limiting
- Uses Cloudflare CF-Connecting-IP header
- Consistent rate limit tracking
- Real-time limit updates in UI
- Clear error messages for rate limits

---

# Policy-Specific Implementations
## DOAD Policy Tool (doadFoo.md)
> See detailed implementation in doadFoo.md

## Future Policy Types
- drmisFoo