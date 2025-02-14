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
   - **Routing Logic**:
     - Add `system` metadata key based on `To:` field:
       - `pacenotefoo@caf-gpt.com` → `pace_notes`
       - `policyfoo@caf-gpt.com` → `policy_foo`
     - Unknown recipients are logged and skipped
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
  - Messages stored as raw email strings with metadata
  - Order preserved from IMAP UID sequence

### Message Parsing
- **Headers Extracted**:
  - `From`: Sender's email address
  - `To`: Recipient address(es)
  - `Subject`: Email subject line
  - `Date`: Received timestamp
- **Body Handling**:
  - Only process `text/plain` content
  - Ignore HTML and attachments

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
  - **Authentication Failures**:
    - Retry with exponential backoff (e.g., 1s, 2s, 4s, 8s)
    - Log failures without exposing sensitive data
    - Set connection status to "unhealthy" after 3 failures
  - **Invalid Credentials**:
    - Validate credentials on startup
    - Fail fast with clear error message
  - **Health Check Integration**:
    - Expose connection status via health check endpoint
    - Include queue size metric
    - Health check returns 503 when in "unhealthy" state
- Email parsing errors
- System routing failures
- Processing timeouts

### IMAP Connection Strategy
- **Connection Pool**:
  - Maintain one persistent connection per inbox
  - Reconnect automatically on connection loss

- **New Email Detection**:
  - Use IMAP IDLE mode for real-time notifications

- **Reconnection Logic**:
  - Exponential backoff starting at 1 second (max 1 hour)
  - Reset backoff counter after successful connection

### Queue Data Structure
```python
@dataclass
class EmailMessage:
    """Represents an email in the processing queue."""
    raw_content: str  # Raw email string from IMAP
    metadata: Dict[str, Any] = field(default_factory=dict)  # Routing and processing metadata

    def get_system(self) -> Optional[str]:
        """Get the target system for this email."""
        return self.metadata.get("system")

    def get_uid(self) -> Optional[int]:
        """Get the IMAP UID for this email."""
        return self.metadata.get("uid")

    def get_received_at(self) -> Optional[datetime]:
        """Get the timestamp when the email was received."""
        return self.metadata.get("received_at")

    def is_valid(self) -> bool:
        """Validate that the email has required metadata."""
        return all(
            key in self.metadata
            for key in ["system", "uid", "received_at"]
        )

    def mark_for_retry(self, reason: str) -> None:
        """Mark this email for retry processing."""
        self.metadata["retry_reason"] = reason
        self.metadata["retry_count"] = self.metadata.get("retry_count", 0) + 1

    def to_dict(self) -> Dict[str, Any]:
        """Convert the email to a dictionary for serialization."""
        return {
            "raw_content": self.raw_content,
            "metadata": self.metadata
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "EmailMessage":
        """Create an EmailMessage from a dictionary."""
        return cls(
            raw_content=data["raw_content"],
            metadata=data["metadata"]
        )
```
