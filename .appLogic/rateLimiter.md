# Rate Limiter Design

## Overview
Simple sliding window rate limiter with hourly and daily limits per IP address, using Cloudflare's CF-Connecting-IP header for reliable IP tracking.

## Implementation
Located in: `src/app/api/utils/rate_limiter.py`

### Core Features
```python
class RateLimiter:
    def __init__(self):
        self.hourly_limits: Dict[str, List[float]] = {}
        self.daily_limits: Dict[str, List[float]] = {}
        self._cleanup_task = asyncio.create_task(self._periodic_cleanup())

    async def check_rate_limit(self, request: Request) -> bool:
        ip = request.headers.get('CF-Connecting-IP', '0.0.0.0')
        return await self._check_limits(ip)
```

- Sliding window implementation
- In-memory storage (for simplicity)
- Cloudflare IP-based tracking
- UTC timestamp-based calculations
- Memory cleanup every 15 minutes
- CIDR-based whitelist validation
- Two concurrent window types:
  - Hourly: 10 requests/hour
  - Daily: 30 requests/day

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
```python
class RateLimitConfig(BaseSettings):
    HOURLY_LIMIT: int = 10
    DAILY_LIMIT: int = 30
    CLEANUP_INTERVAL: int = 900  # 15 minutes
    WHITELISTED_CIDRS: List[str] = []
```
- All limits defined in config.py
- Development mode uses same IP resolution
- Configurable cleanup interval
- Whitelisted CIDR ranges

### Key Components
- IP Validation
  - Simple IP normalization (lowercase only)
  - CIDR range matching for whitelists
  - Consistent IP format across all endpoints

- Window Management
  ```python
  async def _cleanup_windows(self):
      now = time.time()
      self._cleanup_window(self.hourly_limits, now - 3600)
      self._cleanup_window(self.daily_limits, now - 86400)
  ```
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
