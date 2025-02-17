# CAF-GPT Application Plan

## Overview
Email-based AI tools for army personnel. IMAP processing with system routing.

## Core Components

### Email Processing
1. **IMAPConnection**
   - IMAP connection/auth
   - Message retrieval
   - Health tracking

2. **EmailProcessor**
   - Processing workflow
   - System routing
   - Error handling
   - Queue management

## Core Principles
- Browser-side user messages
- PII-safe logging
- Minimal interfaces
- Minimal dependencies
- Clean separation
- Read-only data
- Direct env vars
- Type-safe code
- Async handling
- Rate limiting

## Stack

### Python
- 3.12
- imaplib, boto3

### Testing
- Pytest
- Async support
- High coverage

### Storage
- Storj (S3-compatible)
- Read-only access

### Type Safety
- TypedDict/Optional
- Runtime validation
- CI type checks

## Development vs Production

### Development (DEVELOPMENT=true)
- Debug logging
- Hot reload
- Mock services
- Verbose errors

### Production (DEVELOPMENT=false)
- Info logging
- Rate limits
- Real services
- PII filtering
- Performance focused

## Future Plans
- System metrics
- Health monitoring
- Alerting
- Performance suite

See component docs for details.