# Email Processing Simplification Plan

## Core Changes Overview
```python
# Update existing EmailMessage in src/types.py
@dataclass
class EmailMessage:
    """Represents a parsed email message."""
    uid: int
    from_addr: str
    to_addr: List[str]
    subject: str
    body: str
    system: str
    received_at: datetime = field(default_factory=lambda: datetime.now())
    retry_count: int = 0
    
    def is_valid(self) -> bool:
        """Check if email has all required fields."""
        return bool(
            self.uid and
            self.from_addr and
            self.to_addr and
            self.system
        )
```

## Implementation Order

### Phase 1: Type Updates ✅
- [x] Update `src/types.py`
  - [x] Modify `EmailMessage` class to simpler structure
  - [x] Remove unused fields and methods
  - [x] Keep minimal retry functionality (counter only)
  - [x] Update docstrings and type hints
  - [x] Keep queue and health check types for main.py

### Phase 2: Parser Updates ✅
- [x] Update `src/emails/parser.py`
  - [x] Add `_detect_system` method with basic routing rules
  - [x] Update `parse_email` signature to include `uid`
  - [x] Modify return type to use simplified `EmailMessage`
  - [x] Remove `_normalize_address` method
  - [x] Keep `_get_clean_body` method
  - [x] Keep `_convert_html` method
  - [x] Keep `_clean_text` method
  - [x] Update imports for new `EmailMessage` structure
  - [x] Update error handling to match new structure
  - [x] Add better logging with metadata

### Phase 3: Connection Layer ✅
- [x] Update `src/emails/connection.py`
  - [x] Modify `get_unread_messages` to pass `uid` to parser
  - [x] Update return type annotations
  - [x] Update error handling for new message type
  - [x] Add logging for message processing
  - [x] Remove unused `_determine_system` method
  - [x] Improve error handling with metadata
  - [x] Clean up type ignores
  - [x] Standardize mailbox terminology

### Phase 4: Queue Management ✅
- [x] Update `src/emails/queue_add.py`
  - [x] Update message validation to use `EmailMessage.is_valid()`
  - [x] Modify queue processing for simplified type
  - [x] Update logging messages
  - [x] Add type hints for new message format
  - [x] Simplify retry handling
  - [x] Improve metrics tracking
  - [x] Remove complex retry statistics
  - [x] Clean up error handling

### Phase 5: LLM Updates ✅
- [x] Update `src/llm/__init__.py`
  - [x] Update `LLMRouter` to use simplified `EmailMessage`
  - [x] Update `route_email` to use direct `system` field
  - [x] Update logging to match new format
  - [x] Remove metadata and raw_content references
  - [x] Make route_email async
  - [x] Improve queue processing
  - [x] Better error handling
- [x] Update `src/llm/pace_note/__init__.py`
  - [x] Update handler to use simplified `EmailMessage`
  - [x] Update logging format
  - [x] Add type hints and docstrings
  - [x] Add handler statistics
  - [x] Make process method async
  - [x] Improve error handling

## All Phases Complete ✅
1. ✅ Type Updates
2. ✅ Parser Updates
3. ✅ Connection Layer
4. ✅ Queue Management
5. ✅ LLM Updates

## Key Improvements Made
1. Simplified data structures
2. Better error handling
3. Consistent logging patterns
4. Improved async support
5. Better metrics tracking
6. Cleaner code organization

## Code Examples

### Updated Parser Implementation
```python
def parse_email(self, raw_bytes: bytes, uid: int) -> Optional[EmailMessage]:
    try:
        mail = self.parser.parse_from_bytes(raw_bytes)
        
        # Get primary recipient for system detection
        to_addr = mail.to[0] if mail.to else ""
        system = self._detect_system(to_addr)
        
        message = EmailMessage(
            uid=uid,
            from_addr=mail.from_[0][1] if mail.from_ else "",  # Take email part of tuple
            to_addr=[addr[1] for addr in mail.to],  # Extract email parts
            subject=mail.subject.strip() if mail.subject else "",
            body=self._get_clean_body(mail),
            system=system
        )
        
        if message.is_valid():
            logger.info("Email parsed successfully", metadata={
                "uid": uid,
                "from": message.from_addr,
                "system": system
            })
            return message
        else:
            logger.warning("Parsed email failed validation", metadata={
                "uid": uid,
                "missing_fields": [
                    f for f in ["uid", "from_addr", "to_addr", "system"]
                    if not getattr(message, f)
                ]
            })
            return None

    except (MailParserError, UnicodeError, ValueError) as e:
        logger.exception(f"Parse error: {str(e)}", metadata={
            "uid": uid,
            "error_type": type(e).__name__
        })
        return None

def _detect_system(self, address: str) -> str:
    """Detect which system should handle this email based on address."""
    if not address:
        return ""
        
    # Extract email part if in tuple format
    if isinstance(address, tuple) and len(address) == 2:
        address = address[1]
        
    # Convert to lowercase for matching
    address = address.lower()
    
    # Define system mapping patterns
    patterns = {
        r"support@": "support",
        r"help@": "support",
        r"sales@": "sales",
        r"info@": "info",
        r"admin@": "admin"
    }
    
    # Check each pattern
    for pattern, system in patterns.items():
        if pattern in address:
            return system
            
    return "unknown"  # Default system
```

### Updated Connection Implementation
```python
def get_unread_messages(self) -> List[EmailMessage]:
    messages = []
    for uid, raw_email in self._fetch_unread():
        parsed = self.parser.parse_email(raw_email, uid)
        if parsed and parsed.is_valid():
            messages.append(parsed)
            logger.debug(f"Parsed message {uid} from {parsed.from_addr}")
    return messages
```

### Updated LLM Router Implementation
```python
def route_email(self, email: EmailMessage) -> None:
    """Route email to appropriate handler based on system.
    
    Args:
        email: The email message to route to appropriate handler
    """
    logger.debug("LLM Router received email", metadata={
        "system": email.system,
        "uid": email.uid,
        "from": email.from_addr
    })
    
    if email.system == "pace_notes":
        logger.debug("Routing to PaceNote handler")
        self.pace_note.process(email)
    else:
        logger.warning("Unknown system for email", metadata={
            "system": email.system,
            "uid": email.uid
        })
```

## Testing Checklist
- [ ] Unit Tests
  - [ ] EmailMessage validation
  - [ ] Parser with various email formats
  - [ ] Connection layer with mock IMAP
  - [ ] Queue operations with new format
  - [ ] Router with test handlers

- [ ] Integration Tests
  - [ ] End-to-end email processing
  - [ ] Error handling scenarios
  - [ ] System detection logic
  - [ ] Queue management flow

## Migration Notes
- Keep existing error handling patterns
- Maintain current logging levels
- Consider keeping retry functionality if needed
- Update any code importing from models/ to use types.py
