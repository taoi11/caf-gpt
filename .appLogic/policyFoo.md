# PolicyFoo Base Handler

## Core Structure
### Base Architecture
- Modular policy tool router system
- Common response formatting
- Shared rate limiting
- Unified error handling
- Request validation
- Conversation history management

### Frontend
- One frontend for all policy tools
- Top navigation bar
- Common UI elements
  - Rate limit display
  - Chat interface
  - Input controls
- Dropdown menu for policy group selection

### Request Flow
1. User selects policy tool type
2. Enters message with optional conversation history
3. Request validated and rate limited
4. Routed to appropriate policy handler
5. Response formatted and returned
6. UI updated with response

### Rate Limiting
- Uses Cloudflare CF-Connecting-IP header
- Consistent rate limit tracking
- Real-time limit updates in UI
- Clear error messages for rate limits

### Error Handling
- Request validation errors
- Rate limit notifications
- Internal processing errors
- Network timeout handling
- Clear user feedback

---

# Policy-Specific Implementations
## DOAD Policy Tool (doadFoo.md)
> See detailed implementation in doadFoo.md

## Future Policy Types
- drmisFoo