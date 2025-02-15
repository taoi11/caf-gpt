# Email Processing Module

## Overview
Handles IMAP email retrieval and routing for two inboxes:
1. `pacenotefoo@caf-gpt.com` - Routes to Pace Notes system
2. `policyfoo@caf-gpt.com` - Routes to Policy Foo system

## Architecture

### Data Flow
0. Initialization
   - On startup: Connect to IMAP
   - Reload all unread messages into queue
   - Maintain original received order

1. Queue Management
   - Thread-safe in-memory storage using Python's deque
   - Cold start protection via IMAP reload
   - No persistent storage of queue state
   - Lock-based concurrency control

2. Processing Flow
   - Emails added to queue as received
   - **Routing Logic**:
     - Add `system` metadata key based on `To:` field:
       - `pacenotefoo@caf-gpt.com` → `pace_notes`
       - `policyfoo@caf-gpt.com` → `policy_foo`
     - Unknown recipients are logged and skipped
   - Async processing loop with health checks
   - Success confirmation required before next item
   - Mark email as read after processing
   - Failed emails are retried with exponential backoff

## Technical Implementation

### Environment Variables
```
EMAIL_HOST=127.0.0.1
EMAIL_PASSWORD=****
IMAP_PORT=1143
SMTP_PORT=1025
```

### System Design
- **Queue Characteristics**:
  - Pure Python deque with maxlen=100
  - Thread-safe operations
  - Messages stored as EmailMessage objects
  - Order preserved from IMAP UID sequence

- **Connection Management**:
  - Single IMAP connection with health monitoring
  - Automatic reconnection with exponential backoff
  - Connection status exposed via health check

- **Health Monitoring**:
  - Queue statistics (size, processing state)
  - Connection health (status, retry count)
  - Integrated with FastAPI health check endpoint

### Message Parsing
- **Headers Extracted**:
  - `From`: Sender's email address
  - `To`: Recipient address(es)
  - `Subject`: Email subject line
  - `Date`: Received timestamp
- **Body Handling**:
  - Only process `text/plain` content
  - Ignore HTML and attachments

### Error Handling
- **IMAP Connection Failures**:
  - Exponential backoff (1s to 1 hour)
  - Health status monitoring
  - Automatic reconnection attempts

- **Processing Errors**:
  - Failed messages marked for retry
  - Retry count tracking
  - Error reason logging

- **Queue Management**:
  - Full queue handling (drop new messages)
  - Thread-safe operations
  - Processing state tracking

### Integration
- Async startup/shutdown methods
- Health check status reporting
- Background processing loop
- Clean process lifecycle management
