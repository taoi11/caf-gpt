# CAF-GPT Application Plan

## Overview
A collection of AI tools and agents for army personnel, packaged as a Python FastAPI Docker container. Designed to run behind Cloudflare for security and rate limiting.

## Core Principles
- Keep user messages browser-side only
- Prevent user identifiable data from entering logs
- Provide simple and minimal tool interfaces
- Use minimal dependencies and frameworks
- Maintain clear separation of client and server code
- Use read-only data access patterns
- Direct environment variable usage
- Simplified configurations
- Robust testing with clean async handling
- Cloudflare-based security and rate limiting

## Technology Stack
- Python 3.11+ for server-side logic
  - FastAPI for API endpoints
  - Pydantic for data validation
  - HTTPX for async HTTP calls
- Jest replaced with Pytest
  - Async test support
  - Proper fixture cleanup
  - High test coverage targets
- Custom CSS for styling
  - Slim navigation design
  - Modern UI components
- HTML with vanilla JavaScript
- Docker for containerization
- Cloudflare for:
  - IP-based rate limiting
  - Security headers
  - DDoS protection
- Storj S3-compatible storage
  - Uses boto3 SDK
  - Gateway endpoint at gateway.storjshare.io
  - Read-only access configuration

## Project Structure
```
cap-gpt/
├── .appLogic/                    # Application documentation
│   ├── overview.md              # Main project documentation
│   ├── paceNote.md             # Pace Notes tool documentation
│   ├── costTracker.md          # Cost tracking documentation
│   ├── rateLimiter.md          # Rate Limiter documentation
│   ├── policyFoo.md            # Policy tool base documentation
│   └── doadFoo.md             # DOAD policy tool documentation
src/
├── tests/                      # Test files
│   └── utils/                  # Utility tests
│       └── test_rate_limiter.py # Rate limiter tests
├── prompts/
│   ├── paceNote/
│   │   └── paceNote.md    # Pace Notes prompt
│   └── policyFoo/
│       └── doad/
│           ├── policyFinder.md    # DOAD finder prompt
│           ├── policyReader.md    # DOAD reader prompt
│           └── chatAgent.md       # DOAD chat agent prompt
│           └── DOAD-list-table.md # Available DOADs list
│   ├── app/                        # Main Python package
│   │   ├── api/                   # API endpoints
│   │   │   ├── utils/            # Server utilities
│   │   │   │   ├── llm_gateway.py   # LLM Gateway
│   │   │   │   ├── s3_client.py     # S3/Storj client
│   │   │   │   ├── cost_tracker.py  # Cost tracking
│   │   │   │   └── rate_limiter.py  # Rate limiting
│   │   │   ├── pace_notes/       # Pace Notes API
│   │   │   │   ├── agent.py      # Core logic
│   │   │   │   └── routes.py     # Route handler
│   │   │   └── policy_foo/       # Policy tool API
│   │   │       ├── routes.py     # Base handler
│   │   │       └── doad/         # DOAD implementation
│   │   │           ├── base.py   # DOAD base class
│   │   │           └── agents/   # DOAD agents
│   │   ├── models/               # Pydantic models
│   │   ├── core/                # Core functionality
│   │   │   ├── config.py        # App configuration
│   │   │   └── logging.py       # Logging setup
│   │   └── main.py             # FastAPI application
│   └── public/                     # Static assets
│       ├── index.html             # Landing page
│       ├── paceNotes.html         # Pace Notes tool page
│       ├── policyFoo.html         # Policy tool page
│       ├── css/                   # CSS files
│       │   ├── common.css         # Shared styles
│       │   ├── paceNotes.css      # Pace Notes styles
│       │   └── policyFoo.css      # Policy tool styles
│       └── js/                    # Compiled client JavaScript
├── dist/                      # Compiled server code
├── coverage/                  # Test coverage reports (gitignored)
├── .env.example               # Environment variables template
├── Dockerfile                # Docker configuration
├── .gitignore                # Git ignore patterns
├── .dockerignore             # Docker ignore patterns
├── requirements.txt          # Python package dependencies
└── pytest.ini               # Pytest configuration
```

## Environment Variables
Direct usage of environment variables for:
- S3 configuration
- LLM API settings
- Server configuration
- Rate limiting options
- Cloudflare settings

## Storage Architecture
### S3-Compatible Storage (Storj)
- Now uses boto3 SDK instead of AWS SDK
- Fixed endpoint at gateway.storjshare.io
- Read-only access configuration
- Direct environment variable usage:
  - `S3_BUCKET_NAME`
  - `S3_ACCESS_KEY_ID`
  - `S3_SECRET_ACCESS_KEY`

## Frontend Architecture
### UI State Management
- Python backend types using Pydantic:
  ```python
  class UIState(BaseModel):
      input_text: str      # Form inputs
      messages: List[Message]  # Chat/output history
      is_processing: bool  # Loading states
  ```

### UI Components
- Tool-specific UI classes
- Shared rate limiter display
- Common navigation elements
- State persistence:
  - Session storage for form inputs
  - In-memory for chat history
  - Real-time rate limit updates

### Event Handling
- Keyboard shortcuts (Ctrl+Enter)
- Copy-to-clipboard functionality
- Error message display
- Loading states
- Rate limit warnings

## Recent Changes
- **Framework Migration**: 
  - Moved from Node.js to Python/FastAPI
  - Updated project structure for Python conventions
  - Switched to Pydantic models
- **Rate Limiter**: 
  - Switched to Cloudflare IP-based tracking
  - Simplified IP handling
  - Consistent rate limiting across all endpoints
- **Security**:
  - Added Cloudflare integration
  - Better error handling
  - Improved logging
