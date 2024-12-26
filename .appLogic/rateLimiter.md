# Rate Limiter Design

## Overview
Simple sliding window rate limiter with hourly and daily limits per IP address.

## Implementation
Located in: `src/server/api/utils/rateLimiter.ts`

### Core Features
- Sliding window implementation
- In-memory storage (for simplicity)
- IP-based tracking
- Whitelisted IPs bypass limits:
  - 131.136.0.0/16
- Two concurrent window types:
  - Hourly: 10 requests/hour
  - Daily: 30 requests/day
- Development mode bypass option

### Applicable to
- All API endpoints requiring rate limiting
- Integrated directly into route handlers
