# CAF-GPT Application Plan

## Overview
Email-based AI tools for army personnel. IMAP processing with system routing. Processing reliability through mailbox persistence.

## Core Components

### Email Processing
The email processing subsystem handles retrieving, parsing, and queuing emails for further processing:

- **IMAPConnection**: Secure email retrieval and connection management
- **EmailQueue**: Thread-safe message handling with state tracking
- **QueueManager**: Orchestrates the email processing workflow
- **EmailParser**: Extracts content and determines appropriate processing system
- **SystemDetector**: Identifies appropriate processing system based on email recipient

See emailModule.md for detailed implementation.

### LLM Processing
1. **LLMRouter**
   - Message routing
   - Handler selection
   - Processing coordination
   - Mailbox management (marking as read after processing)
   - Queue state updates

2. **Handlers**
   - Message processing
   - State updates
   - No queue management
   - Processing status reporting

See llmModule.md for detailed implementation.

## Message Workflow
1. Email arrives in mailbox (unread)
2. QueueManager fetches unread emails but preserves unread status
3. Emails are queued for processing by appropriate system
4. LLMRouter picks up queued emails and routes to handlers
5. After successful processing, LLMRouter:
   - Marks email as read in mailbox
   - Updates queue state
6. This workflow ensures emails remain available for retry in case of application failure

## System Routing
The application routes emails to different processing systems based on the recipient's email address. Currently supports:

- **pace_notes**: For pace notes processing
- **policy_foo**: For policy-related processing

See emailModule.md for implementation details.

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