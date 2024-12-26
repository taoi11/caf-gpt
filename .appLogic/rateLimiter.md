# Rate Limiter Design

## Overview
Simple sliding window rate limiter with hourly and daily limits per IP address.

## Implementation
Located in: 
`src/server/api/utils/rateLimiter.ts`
`src/server/api/middleware/rateLimitMiddleware.ts`

### Core Features
- Sliding window implementation
- In-memory storage (for simplicity)
- IP-based tracking
- White list 
  - 131.136.0.0/16
- Two window types:
  - Hourly: 10 requests/hour
  - Daily: 30 requests/day

### Applicable to:
- Pace Note API
  - All successful responses
- PolicyFoo
  - Only successful return from chatAgent
