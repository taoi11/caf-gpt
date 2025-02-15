# Email Parser Implementation Plan

## Overview
Implementation plan for email parsing system using mailparser library to process incoming emails for LLM digestion. Parsed data will flow through the queue to maintain module separation.

## File Changes Checklist

### 1. `src/types.py`
- [ ] Add `parsed_content` field to `EmailMessage` class
- [ ] Add validation method for parsed content
```python
@dataclass
class EmailMessage:
    """Represents an email in the processing queue."""
    raw_content: str  # Raw email string from IMAP
    parsed_content: Optional[Dict[str, Any]] = None  # Parsed email data
    metadata: Dict[str, Any] = field(default_factory=dict)  # Routing and processing metadata

    def has_valid_parsed_content(self) -> bool:
        """Check if parsed content has required fields."""
        if not self.parsed_content:
            return False
        return all(
            key in self.parsed_content
            for key in ["subject", "body", "from", "to"]
        )
```

### 2. `src/emails/parser.py` (New)
- [ ] Create `EmailParser` class with error tracking
- [ ] Add logging for parse operations
```python
class EmailParser:
    def __init__(self):
        self.parser = mailparser
        self.logger = logging.getLogger("email_parser")
        self.parse_errors: Dict[str, int] = {}  # Track error types

    def parse_email(self, raw_bytes: bytes) -> Optional[Dict[str, Any]]:
        """Parse email with logging and error tracking."""
        try:
            self.logger.debug("Starting email parse")
            mail = self.parser.parse_from_bytes(raw_bytes)
            
            parsed = {
                "subject": mail.subject,
                "from": mail.from_,
                "to": mail.to,
                "date": mail.date,
                "body": self._get_clean_body(mail),
                "has_attachments": bool(mail.attachments_list)
            }
            
            self.logger.info("Email parsed successfully", extra={
                "has_body": bool(parsed["body"]),
                "has_attachments": parsed["has_attachments"]
            })
            
            return parsed

        except Exception as e:
            error_type = type(e).__name__
            self.parse_errors[error_type] = self.parse_errors.get(error_type, 0) + 1
            self.logger.error(f"Parse error: {str(e)}", extra={
                "error_type": error_type,
                "error_count": self.parse_errors[error_type]
            })
            return None
```

### 3. `src/emails/connection.py`
- [ ] Add `EmailParser` instance
- [ ] Update `get_unread_messages` to include parsing and logging
```python
def get_unread_messages(self):
    # Add parsing with logging
    email_msg.parsed_content = self.parser.parse_email(email_body)
    if not email_msg.has_valid_parsed_content():
        logger.warn("Invalid parsed content", extra={
            "uid": email_msg.get_uid()
        })
```

### 4. `src/emails/processor.py`
- [ ] Add `EmailParser` instance
- [ ] Update `_process_queue` to handle parsed content
```python
async def _process_queue(self):
    if not email.parsed_content:
        email.parsed_content = self.parser.parse_email(email.raw_content)
        if not email.has_valid_parsed_content():
            email.mark_for_retry("Invalid parsed content")
```

### 5. `src/emails/queue.py`
- [ ] Update queue stats to track parsed messages
```python
def get_stats(self):
    return {
        "parsed_messages": sum(1 for msg in self.queue if msg.parsed_content)
    }
```

### 6. `requirements.txt`
- [X] Add mailparser dependency
```
mail-parser>=4.0.0
```

### 7. `src/main.py`
- [ ] Update main application flow
```python
async def main():
    # Ensure parsed content flows through queue
    llm_router.start_watching(email_processor.queue)
```