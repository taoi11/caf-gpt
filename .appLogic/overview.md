# CAF-GPT Application Plan

## Overview
Email-based AI tools for army personnel. IMAP processing with system routing.

## Core Components

### Email Processing
1. **IMAPConnection**
   - IMAP connection/auth
   - Message retrieval
   - Health tracking

2. **EmailQueue**
   - Message state tracking
   - Processing workflow
   - System routing
   - Error handling
   - Queue management
   - Message lifecycle control
   - State transitions (new → processing → processed)

3. **QueueManager** (formerly EmailProcessor)
   - Email parsing and validation
   - Queue management
   - Post-processing cleanup
   - Final message removal
   - Retry orchestration
   - Health monitoring

### LLM Processing
1. **LLMRouter**
   - Message routing
   - Handler selection
   - Processing coordination

2. **Handlers**
   - Message processing
   - State updates
   - No queue management
   - Processing status reporting

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

## Retry Mechanism
- Exponential backoff (5s base)
- Maximum 3 retries
- Separate retry queue
- Comprehensive tracking
- Health monitoring
- Failure categorization

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