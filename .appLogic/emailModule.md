# Email Processing Module

## Overview
IMAP email handling with queue-based LLM processing. Clean separation between fetch and process.

## Components

### EmailParser
- mail-parser for robust parsing
- Plain text preferred
- Error tracking/stats
- HTML fallback

### IMAPConnection
- BODY.PEEK[] fetching
- Immediate parsing
- Health tracking
- Read after process

### EmailQueue
- Thread-safe deque
- 100 message cap
- IMAP UID ordering
- Dedup tracking
- Retry with backoff
- Retry state in metadata
- Message state tracking (new, processing, processed, failed)
- Queue removal only after successful processing confirmation

### EmailProcessor
- Workflow orchestration
- Queue management
- No duplicates
- Clean shutdown
- Handles post-processing queue cleanup
- Manages message lifecycle

## Data Flow
1. Init: IMAP connect, env load, logging setup
2. Process Flow:
   - Fetch → Parse → Add to Queue
   - LLM Processing (marks messages as processed)
   - Queue cleanup and post-processing tasks
   - Final message removal from queue

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

2. Retries:
   - Max 3 attempts
   - 2^n min delay (5 max)
   - State in metadata

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
