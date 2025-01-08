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

### Recent Changes
- Added proper cleanup interval management
- Improved IPv6 handling with separate tracking
- Enhanced test coverage for all core features
- Added memory management tests
- Fixed async cleanup issues in tests

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

### Rate Limit Flow
1. Check request eligibility
2. Track only successful LLM API calls
3. Simple error responses for exceeded limits
4. Frontend displays current limits

### Configuration
- All limits defined in config.ts
- Development mode bypass option
- Configurable cleanup interval
- Whitelisted CIDR ranges

### API Integration
- Direct route handler integration
- Simple success/error responses
- No complex header management
- Frontend limit display support
