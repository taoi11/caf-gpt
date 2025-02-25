# Email Processing Module

## Overview
IMAP email handling with queue-based LLM processing. Clean separation between fetch and process. Emails remain unread until processing is completed to ensure reliability.

## Components

### EmailParser
- Email content extraction and parsing
- mail-parser for robust parsing
- Plain text preferred, HTML fallback
- Header parsing and validation
- System detection based on exact email address matching
- Supports two specific email addresses:
  - pacenotefoo@caf-gpt.com → pace_notes system
  - policyfoo@caf-gpt.com → policy_foo system
- HTML to text conversion
- Error tracking/stats
- Comprehensive logging

### IMAPConnection
- IMAP connection/auth
- BODY.PEEK[] fetching
- Message retrieval
- Immediate parsing
- Health tracking
- Connection state management
- Marking messages as read (only after successful processing by LLMs)

### EmailQueue
- Thread-safe deque implementation
- 100 message cap
- IMAP UID ordering
- Message state tracking (new, processing, processed, failed)
- Dedup tracking
- Processing workflow management
- System routing
- Error handling
- Queue management
- Retry with backoff
- Retry state in metadata
- State transitions (new → processing → processed)
- Queue removal only after successful processing confirmation
- Task completion tracking

### QueueManager (formerly EmailProcessor)
- Email parsing and validation
- Queue management
- Workflow orchestration
- No duplicates
- Clean shutdown
- Post-processing cleanup
- Final message removal
- Retry orchestration
- Health monitoring
- Message lifecycle management
- Preservation of unread status until processing is complete

### SystemDetector
- Email recipient-based system detection
- Mapping email addresses to specific systems
- Validation of system names
- Support for unknown/invalid detection
- Mailbox path mapping for systems

## Data Flow
1. Init: IMAP connect, env load, logging setup
2. Process Flow:
   - Fetch → Parse → Add to Queue (emails remain unread in mailbox)
   - System detection based on recipient email address
   - Queue provides emails to LLM module for processing
   - Emails remain unread until processing completes
   - LLM module responsible for marking as read after processing
   - Queue cleanup and post-processing tasks

## Email Lifecycle
1. Unread in mailbox
2. Fetched but left unread in mailbox
3. Added to processing queue
4. Processed by LLM system
5. Marked as read in mailbox (by LLM module)
6. Marked as processed in queue (by LLM module)

## Health (MVP)
1. Connection:
   - Last success
   - Error count
   - State/retries

2. Queue:
   - Size/capacity
   - Parse stats
   - Success rates
   - Retry tracking

## Future Health
1. System (Planned):
   - CPU/Memory
   - Threads
   - Connections
   - Performance

2. Alerts (Planned):
   - Process fails
   - Queue warnings
   - Connection alerts
   - Thresholds

## Error Handling
1. Parser:
   - Type tracking
   - Error stats
   - Clean fails
   - Unknown system detection for non-matching email addresses

2. Retries:
   - Max 3 attempts
   - 2^n min delay (5 max)
   - State in metadata

## System Detection
The application detects which system should handle an email based on the recipient's email address:

```python
# Email address to system mapping
EMAIL_SYSTEM_MAPPING = {
    "pacenotefoo@caf-gpt.com": "pace_notes",
    "policyfoo@caf-gpt.com": "policy_foo"
}
```

Any emails sent to addresses not in this mapping will be marked with an "unknown" system and logged as warnings.

## Config
```python
EMAIL_CONFIG = {
    "host": str,
    "imap_port": int,
    "username": "pacenotefoo@caf-gpt.com",
    "password": str,
    "mailboxes": {
        "pace_notes": "Folders/CAF-GPT/PaceNote",
        "policy_foo": "Folders/CAF-GPT/PolicyFoo"
    }
}
```
