# Rate Limiter Design

## Overview
Simple sliding window rate limiter with hourly and daily limits per IP address.

## Implementation
Located in: `src/server/api/utils/rateLimiter.ts`

### Core Features
- Sliding window implementation
- In-memory storage (for simplicity)
- IP-based tracking
- UTC timestamp-based calculations
- Memory cleanup every 15 minutes
- CIDR-based whitelist validation
- Two concurrent window types:
  - Hourly: 10 requests/hour
  - Daily: 30 requests/day

### API Integration
- Rate limit info endpoint: `/api/ratelimit`
  ```typescript
  interface RateLimitInfo {
    hourly: {
      remaining: number;
      resetIn: number;
    };
    daily: {
      remaining: number;
      resetIn: number;
    };
  }
  ```
- IP version check endpoint: `/api/ratelimit/ip-info`
  ```typescript
  interface IPInfo {
    isIPv6: boolean;
  }
  ```
- Frontend display component for real-time limit tracking
- Auto-updates on each API call
- Visual warnings for low remaining limits

### Rate Limit Flow
1. Check request eligibility
2. Track only successful LLM API calls
3. Return remaining limits in response
4. Frontend displays current limits

### Configuration
- All limits defined in config.ts
- Development mode bypass option
- Configurable cleanup interval
- Whitelisted CIDR ranges

### Key Components
- IP Validation
  - IPv4 normalization
  - IPv6 fallback to non-whitelisted
  - CIDR range matching

- Window Management
  - UTC-based timestamps
  - Floor timestamps to nearest second
  - Simple count-based tracking
  - Automatic window reset

- Memory Management
  - Periodic cleanup of expired entries
  - Only track active rate limits
  - No persistence needed
