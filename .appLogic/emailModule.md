# Email Processing Module

## Overview
Handles IMAP email retrieval and routing from ProtonMail folders:
1. `Folders/CAF-GPT/PaceNote` - Routes to Pace Notes system
2. `Folders/CAF-GPT/PolicyFoo` - Routes to Policy Foo system

## Architecture

### Data Flow
1. Initialization
   - On startup: Connect to IMAP
   - Load configuration from environment
   - Setup logging based on development mode

2. Connection Management
   - Single IMAP connection with health monitoring
   - Folder-based message retrieval
   - Clean error handling

3. Email Processing
   - Continuous processing loop
   - Message deduplication using UID tracking
   - Delayed read marking (after processing)
   - Error handling with logging

### Implementation Details

#### Configuration
```python
# Environment Variables
EMAIL_HOST=100.99.136.75
EMAIL_PASSWORD=****
IMAP_PORT=1143
SMTP_PORT=1025

# Hardcoded values
username="pacenotefoo@caf-gpt.com"

# Hardcoded mailbox paths
mailboxes = {
    "pace_notes": "Folders/CAF-GPT/PaceNote",
    "policy_foo": "Folders/CAF-GPT/PolicyFoo"
}
```

### Message Handling
- **IMAP Fetch**: Uses `BODY.PEEK[]` to prevent auto-marking as read
- **UID Tracking**: Maintains set of processed message UIDs
- **Read Status**: Messages only marked as read after full processing workflow
- **Folder Selection**: Explicit folder selection for each operation

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
- **Deduplication**:
  - Tracks processed UIDs
  - Prevents re-processing of same message
  - Maintains processing history
