# Email Processing Module

## Overview
The email module handles IMAP email fetching, parsing, and queuing for LLM processing. It maintains a clean separation between email handling and LLM processing through a thread-safe queue.

## Architecture

### Components

#### EmailParser
- Uses `mail-parser` library for robust email parsing
- Handles both plain text and HTML content
- Tracks parsing errors and success rates
- Prefers plain text over HTML when available

#### IMAPConnection
- Manages IMAP server connection
- Fetches unread messages using `BODY.PEEK[]`
- Integrates with EmailParser for immediate parsing
- Handles connection health and retries
- Messages only marked as read after full processing

#### EmailQueue
- Thread-safe in-memory storage using Python's deque
- Max capacity: 100 messages
- Message ordering preserved from IMAP UID sequence
- Deduplication via UID tracking
- Retry mechanism with exponential backoff
- Interface between email and LLM modules

#### EmailProcessor
- Orchestrates the email processing workflow
- Manages connection and queue lifecycle
- Ensures no duplicate processing
- Handles graceful startup/shutdown

### Data Flow

1. **Initialization**
   - Connect to IMAP server
   - Load configuration from environment
   - Setup logging based on development mode

2. **Message Processing**
   - IMAPConnection fetches unread emails
   - EmailParser extracts structured content
   - EmailProcessor validates and queues messages
   - LLM module watches queue for new messages

### Health Monitoring

1. **Connection Health**
   - Last successful connection time
   - Connection error count
   - Current connection state
   - Retry status

2. **Queue Statistics**
   - Current size and capacity
   - Parsed vs unparsed messages
   - Processing success/failure rates
   - Average processing time

3. **System Metrics**
   - CPU/memory usage
   - Thread count
   - Active connections

4. **Alerting**
   - Processing failures
   - Queue capacity warnings
   - Connection errors

## Configuration

```python
# Environment Variables
EMAIL_HOST=100.99.136.75
EMAIL_PASSWORD=****
IMAP_PORT=1143
SMTP_PORT=1025

# Email Configuration
EMAIL_CONFIG = {
    "host": str,           # IMAP server host
    "imap_port": int,      # IMAP port
    "username": "pacenotefoo@caf-gpt.com",
    "password": str,       # From environment
    "mailboxes": {         # ProtonMail folder mapping
        "pace_notes": "Folders/CAF-GPT/PaceNote",
        "policy_foo": "Folders/CAF-GPT/PolicyFoo"
    }
}
```
