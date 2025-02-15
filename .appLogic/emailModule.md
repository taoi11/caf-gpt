# Email Processing Module

## Overview
Handles IMAP email retrieval and routing for two specific folders in ProtonMail:
1. `CAF-GPT/PaceNoteFoo` - Routes to Pace Notes system
2. `CAF-GPT/PolicyFoo` - Routes to Policy Foo system

## Architecture

### Data Flow
1. Initialization
   - On startup: Connect to IMAP
   - Select specific mailboxes for processing
   - Load configuration from environment
   - Setup logging based on development mode

2. Connection Management
   - Single IMAP connection with health monitoring
   - Automatic reconnection with exponential backoff
   - Connection status tracking
   - Clean error handling

3. Email Processing
   - Continuous processing loop
   - Mailbox-specific routing (pace_notes/policy_foo)
   - Mark-as-read confirmation
   - Error handling with logging

### Implementation Details

#### Configuration
```python
# Environment Variables
EMAIL_HOST=100.99.136.75
EMAIL_PASSWORD=****
IMAP_PORT=1143
SMTP_PORT=1025

# Hardcoded Mailboxes
MAILBOXES = {
    "pace_notes": "CAF-GPT/PaceNoteFoo",
    "policy_foo": "CAF-GPT/PolicyFoo"
}
```

### Mailbox Handling
- **Folder Selection**: Explicitly select each mailbox before processing
- **Folder Switching**: Switch between mailboxes during processing loop
- **Folder Monitoring**: Track last processed message for each folder
- **Error Handling**: Handle folder access errors gracefully

### Error Handling
- Connection failures with backoff
- Folder access errors with logging
- Graceful shutdown on interrupts
- Development mode detailed logging

### Health Monitoring
- **Connection status**:
  - Last successful connection time
  - Connection error count
  - Current connection state
- **Queue statistics**:
  - Current queue size
  - Messages processed
  - Messages failed
  - Average processing time
- **System metrics**:
  - CPU/memory usage
  - Thread count
  - Active connections
- **Alerting**:
  - Email processing failures
  - Queue capacity warnings
  - Connection errors

### Queue Implementation
- **Thread-safe in-memory storage** using Python's deque
- **Max capacity**: 100 messages
- **Message ordering**: Preserved from IMAP UID sequence
- **Retry mechanism**:
  - Failed messages are requeued
  - Exponential backoff between retries
  - Max retry attempts: 5
- **Message tracking**:
  - UID-based message identification
  - Processing state tracking
  - Error history for failed messages
