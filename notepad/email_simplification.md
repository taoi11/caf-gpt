# Email Processing Simplification Plan

## Core Changes Overview
```python
# Simple email structure
class EmailMessage:
    def __init__(self, uid: int, from_addr: str, to_addr: List[str], 
                 subject: str, body: str, system: str):
        self.uid = uid
        self.from_addr = from_addr  # Simple string email address
        self.to_addr = to_addr      # List of string email addresses
        self.subject = subject
        self.body = body
        self.system = system        # Routing identifier
```

## Files to Modify

### 1. src/emails/parser.py
```python
class EmailParser:
    def parse_email(self, raw_bytes: bytes) -> Optional[EmailMessage]:
        mail = self.parser.parse_from_bytes(raw_bytes)
        
        # Simple direct field access
        return EmailMessage(
            uid=mail.message_id,
            from_addr=mail.from_addr,  # Direct email address
            to_addr=mail.to_addr,      # List of addresses
            subject=mail.subject or "",
            body=self._get_body(mail),
            system=self._detect_system(mail.to_addr[0])
        )
```
- [ ] Class: `EmailParser`
  - [ ] Remove complex `_normalize_address` method
  - [ ] Simplify `parse_email` to use direct mail-parser fields
  - [ ] Update return type to match new EmailMessage structure
  - [ ] Remove unused helper methods

### 2. src/emails/connection.py
```python
class IMAPConnection:
    def get_unread_messages(self) -> List[EmailMessage]:
        messages = []
        for uid, raw_email in self._fetch_unread():
            parsed = self.parser.parse_email(raw_email)
            if parsed:
                messages.append(parsed)
        return messages
```
- [ ] Class: `IMAPConnection`
  - [ ] Update `get_unread_messages` to work with simplified parser
  - [ ] Modify email fetching to use basic fields
  - [ ] Update return types

### 3. src/emails/queue_add.py
```python
class QueueManager:
    def _process_message(self, message: EmailMessage) -> None:
        if not self._validate_message(message):
            logger.warning(f"Invalid message format: {message.uid}")
            return
            
        self.queue.put(message)
        logger.debug(f"Added message {message.uid} from {message.from_addr}")
```
- [ ] Class: `QueueManager`
  - [ ] Update queue processing for simplified message format
  - [ ] Modify message validation
  - [ ] Update logging to reflect new structure

### 4. src/emails/router.py
```python
class LLMRouter:
    def route_message(self, message: EmailMessage) -> None:
        handler = self._get_handler(message.system)
        if handler:
            logger.debug(f"Routing message {message.uid} to {message.system}")
            handler.process(message)
        else:
            logger.warning(f"No handler for system: {message.system}")
```
- [ ] Class: `LLMRouter`
  - [ ] Update message handling for new format
  - [ ] Simplify routing logic
  - [ ] Update logging

### 5. src/models/email.py
```python
from dataclasses import dataclass
from typing import List

@dataclass
class EmailMessage:
    uid: int
    from_addr: str
    to_addr: List[str]
    subject: str
    body: str
    system: str

    def __post_init__(self):
        # Basic validation
        if not self.from_addr or not self.to_addr:
            raise ValueError("Email must have from and to addresses")
```
- [ ] Create new `EmailMessage` class
- [ ] Remove old message type definitions
- [ ] Add type hints and docstrings
