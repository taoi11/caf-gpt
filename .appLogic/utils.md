# Server Utilities Documentation

## Overview
The server utilities provide core infrastructure for the application, handling cross-cutting concerns like rate limiting, cost tracking, and more. All utilities follow a consistent pattern of centralized type usage and singleton instances.

---

## Rate Limiter

### Overview
Simple sliding window rate limiter with hourly and daily limits per IP address, using Cloudflare's CF-Connecting-IP header for reliable IP tracking.

### Implementation
Located in: `src/server/utils/rateLimiter.ts`

### Core Features
- Sliding window implementation
- In-memory storage (for simplicity)
- Cloudflare IP-based tracking
- UTC timestamp-based calculations
- Memory cleanup every 15 minutes
- CIDR-based whitelist validation
- Two concurrent window types:
  - Hourly: 10 requests/hour
  - Daily: 30 requests/day

### Type Integration
- Imports types from top-level `src/server/types.ts`:
  - `RateLimitInfo`: Interface for client-compatible rate limit data 
- Imports Node.js specific type from 'http':
  - `IncomingMessage`: For request handling
- Uses internal interface `RateLimit` from server types

### IP Resolution
- Uses CF-Connecting-IP header exclusively
- No fallback to socket address
- Same behavior in dev and production
- Consistent IP handling across all endpoints

### Rate Limit Flow
1. Extract CF-Connecting-IP from request headers
2. Check request eligibility against limits
3. Track successful LLM API calls
4. Return remaining limits in response
5. Frontend displays current limits

### Configuration
- All limits defined in config.ts
- Development mode uses same IP resolution
- Configurable cleanup interval
- Whitelisted CIDR ranges

### Key Components
- IP Validation
  - Simple IP normalization (lowercase only)
  - CIDR range matching for whitelists
  - Consistent IP format across all endpoints

- Window Management
  - UTC-based timestamps
  - Floor timestamps to nearest second
  - Simple count-based tracking
  - Automatic window reset

- Memory Management
  - Periodic cleanup of expired entries
  - Only track active rate limits
  - No persistence needed

### Error Handling
- Missing CF-Connecting-IP returns '0.0.0.0'
- Detailed warning logs in development mode
- Consistent error responses across endpoints

### Recent Changes
- Switched to CF-Connecting-IP for all IP resolution
- Removed IPv6 specific handling
- Simplified IP normalization
- Consistent IP handling across endpoints
- Better debug logging
- Removed IP info endpoint

---

## Cost Tracker

### Overview
Simple cost tracker for the LLM API calls, storing costs in USD with file-based persistence.

### Implementation
Located in: `src/server/utils/costTracker.ts`

### Core Features
- Tracks total cost in USD
- Includes base monthly server cost of $15.70 USD
- File-based persistence in data/costs.json
- Separate tracking of server and API costs
- Monthly reset on the first day of each month

### Type Integration
- Imports types from top-level `src/server/types.ts`:
  - `CostData`: Interface for cost tracking data structure 
  - `LLMResponse`: Interface for response data used in cost calculations

### Storage Implementation
- JSON file storage in data/costs.json
- Structure:
```json
{
    "apiCosts": number,    // USD
    "serverCosts": number, // USD
    "lastReset": string,   // ISO date
    "lastUpdated": string  // ISO timestamp
}
```
- Auto-creates storage file if missing
- Maintains cost history between server restarts

### Provider Cost Logic
- OpenRouter API costs tracked per token
- Base monthly server cost included automatically

### Frontend Display
- Cost display box in top-right of navigation
- Shows total cost in CAD
- Hover to see breakdown:
  - Server cost
  - LLM API cost
- Auto-updates every minute
- USD to CAD conversion (1.70) handled in frontend

### API Endpoint
`GET /api/costs`
Response:
```json
{
    "apiCosts": number,    // USD
    "serverCosts": number, // USD
    "lastUpdated": string  // ISO timestamp
}
```

### Recent Changes
- Added separate tracking of server and API costs
- Added frontend cost display with hover breakdown
- Improved monthly reset logic for first of month
- Added cost API endpoint
- Frontend currency conversion to CAD

---

## Other Utils Modules

The following utility modules are also part of the server infrastructure:

### Logger
- Located in: `src/server/utils/logger.ts`
- Provides structured logging with multiple log levels (DEBUG, INFO, WARN, ERROR)
- Special handling for LLM interactions with request/response correlation
- Environment-aware logging behavior (more verbose in development)
- Request tracking with unique identifiers
- Response time measurement for LLM calls
- Redaction of sensitive information in system prompts
- Imports types from server/types.ts including LogLevel enum and structured log interfaces

### LLM Gateway
- Located in: `src/server/utils/llmGateway.ts`
- Centralizes all LLM API interactions through OpenRouter
- Manages request throttling with concurrency control
- Formats requests with system prompts and context management
- Handles error normalization using the LLMError type
- Tracks token usage and costs via costTracker integration
- Provides logging of all LLM interactions
- Imports types from server/types.ts for consistent typing across the application

### S3 Client
- Located in: `src/server/utils/s3Client.ts`
- Provides interface to Storj S3-compatible storage
- Configured for read-only access pattern
- Used for policy document retrieval
- Path-style endpoint access
- Environment-based configuration
- Imports PolicyDocument type from server/types.ts for consistent type definitions

### Config
- Located in: `src/server/utils/config.ts`
- Centralizes environment variables and configuration
- Validates required environment variables on startup
- Provides constants used by other modules
- Defines time constants (HOUR, DAY) used in rate limiting
- Manages environment-specific behavior
- Exports model configurations for different features 