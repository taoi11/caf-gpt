# Server Utilities Documentation

## Overview
The server utilities provide core infrastructure for the application, handling cross-cutting concerns like rate limiting, cost tracking, logging, and more. All utilities follow a consistent pattern of centralized type usage and singleton instances.

---

## Rate Limiter

### Overview
Simple sliding window rate limiter with hourly and daily limits per IP address, using Cloudflare's CF-Connecting-IP header for reliable IP tracking.

### Implementation
Located in: `src/server/utils/rateLimiter.ts`

### Interface and Type System
- Implements the `NodeRateLimiter` interface from `src/server/node-types.ts`
- All type definitions are centralized in `src/server/types.ts`
- Main types:
  - `RateLimit`: Internal tracking data structure for IP limits
  - `RateWindow`: Window tracking for hourly/daily limits
  - `RateLimitInfo`: Client-compatible rate limit information

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

### Key Methods
- `canMakeRequest(req)`: Checks if a request can proceed
- `trackSuccessfulRequest(req)`: Records successful API calls
- `getLimitInfo(req)`: Gets remaining limits for client display
- `sendLimitResponse(req, res, type)`: Handles rate limit exceeded responses

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
- HTTP 429 responses include Retry-After headers

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

### Interface and Type System
- Uses centralized type definitions from `src/server/types.ts`
- Main types:
  - `CostData`: Interface for persistent cost data structure
  - `LLMResponse`: Interface for API responses used in cost calculations

### Core Features
- Tracks total cost in USD
- Includes base monthly server cost of $15.70 USD
- File-based persistence in data/costs.json
- Separate tracking of server and API costs
- Monthly reset on the first day of each month

### Key Methods
- `trackCost(response)`: Calculates and records cost from an LLM API call
- `getCosts()`: Returns current cost data for API and display
- `resetMonthly()`: Handles automatic monthly cost resets

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

## Logger

### Overview
Structured logging system with request tracking, LLM interaction logging, and environment-aware behavior.

### Implementation
Located in: `src/server/utils/logger.ts`

### Interface and Type System
- Uses centralized type definitions from `src/server/types.ts`
- Main types:
  - `LogLevel`: Enum with DEBUG, INFO, WARN, ERROR levels
  - `LogEntry`: Structured log entry format
  - `LLMInteractionData`: Data structure for LLM requests/responses

### Core Features
- Multiple log levels (DEBUG, INFO, WARN, ERROR)
- String-based enum for LogLevel for better compatibility
- Environment-aware verbosity (more verbose in dev)
- Special handling for LLM interactions
- Request/response correlation with unique IDs
- Response time measurement for LLM calls
- Redaction of sensitive information in prompts

### Key Methods
- `debug()`, `info()`, `warn()`, `error()`: Standard logging methods
- `logLLMRequest()`: Special handling for LLM API requests
- `logLLMResponse()`: Records API responses with timing information
- `logAgentInteraction()`: Used by DOAD agents to log interactions

### Security Features
- Redaction of sensitive information in system prompts
- Customizable redaction patterns
- Truncation of long messages to prevent log bloat
- Omission of headers in production environment

### Request Tracking
- Unique identifiers for request/response correlation
- Request start time tracking
- Response time calculation
- Consistent format across all log entries

---

## LLM Gateway

### Overview
Centralized gateway for all LLM API interactions with error handling, cost tracking, and logging.

### Implementation
Located in: `src/server/utils/llmGateway.ts`

### Interface and Type System
- Uses centralized type definitions from `src/server/types.ts`
- Main types:
  - `LLMRequest`: Structure for API requests
  - `LLMResponse`: Structure for API responses
  - `LLMError`: Normalized error format

### Core Features
- Single point of integration with OpenRouter API
- Consistent error handling and normalization
- Automatic retry logic for transient errors
- Request throttling with concurrency control
- Token usage and cost tracking
- Comprehensive logging of all interactions
- System prompt management

### Key Methods
- `sendRequest()`: Primary method for sending requests to LLM
- `formatMessages()`: Prepares message format for API
- `handleError()`: Normalizes various error responses
- `getTokenCount()`: Estimates token usage

### Integration Points
- Integrates with costTracker for usage-based billing
- Uses logger for request/response tracking
- Consumes config.ts for model settings

---

## S3 Client

### Overview
Interface to Storj S3-compatible storage for policy document retrieval.

### Implementation
Located in: `src/server/utils/s3Client.ts`

### Interface and Type System
- Uses PolicyDocument type from `src/server/types.ts`

### Core Features
- Read-only access to S3-compatible storage
- Used for policy document retrieval
- Path-style endpoint access
- Environment-based configuration

### Key Methods
- `getPolicyDocument()`: Retrieves document by ID
- `listPolicyDocuments()`: Lists available documents

---

## Config

### Overview
Centralized configuration management with environment variable validation.

### Implementation
Located in: `src/server/utils/config.ts`

### Core Features
- Environment variable validation
- Constants used across the application
- Time constants (HOUR, DAY) for rate limiting
- Environment-specific behavior flags
- Model configurations for different features

### Key Sections
- Environment detection (IS_DEV, IS_PROD)
- API keys and endpoints
- Rate limiting configuration
- Model settings for different agents
- Feature flags and toggles

### Usage Pattern
- Imported at the top of utility files
- Provides consistent configuration across the application
- Single source of truth for all configuration values 