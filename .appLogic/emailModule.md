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
   - In-memory storage
   - Cold start protection via IMAP reload
   - No persistent storage of queue state

2. Processing Flow
   - Emails added to queue as received
   - LLM processes one item at a time
   - Success confirmation required before next item
   - Mark email as read after processing

## Technical Implementation

### Environment Variables
```
IMAP_HOST=127.0.0.1
IMAP_PORT=1143
IMAP_PASSWORD= # From Proton Mail Bridge
```

### System Design
- Queue characteristics:
  - Pure Python deque with maxlen=100
  - Messages stored as raw email strings
  - Order preserved from IMAP UID sequence
- Startup sequence:
  1. Connect to IMAP servers
  2. Scan both inboxes for UNSEEN messages
  3. Sort messages by UID (chronological order)
  4. Preload into processing queue

## Design Principles
1. **Message Integrity**
   - Only mark as read after successful processing
   - Maintain full email chain context

2. **Security**
   - No user data in logs
   - Encrypted IMAP connection
   - Minimal data retention

3. **Reliability**
   - Retry failed operations
   - Graceful error handling
   - State tracking for interrupted processing

4. **Resource Contention**
   - Single queue prevents LLM overload
   - Explicit flow control
   - Fair access between systems

5. **Stateless Operation**
   - Queue rebuilt from source-of-truth (IMAP)
   - No local persistence of messages
   - Immediate message release on success

## Error Handling
- IMAP connection failures
- Email parsing errors
- System routing failures
- Processing timeouts