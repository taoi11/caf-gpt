"""Type definitions for the application. All types are defined here."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import TypedDict, Dict, Any, List

# LLM types
@dataclass
class Message:
    """Represents a message in a conversation with the LLM."""
    role: str  # 'system', 'user', or 'assistant'
    content: str

class LLMResponse(TypedDict):
    """Response from the LLM."""
    content: str
    model: str
    usage: Dict[str, int]

@dataclass
class LLMErrorDetails:
    """Details about an LLM error."""
    code: int
    message: str
    error_type: str

# Email types
@dataclass
class EmailMetadata:
    """Metadata for email processing."""
    received_at: datetime = field(default_factory=datetime.now)
    system: str = ""

@dataclass
class EmailMessage:
    """Represents a parsed email message."""
    uid: int
    from_addr: str
    to_addr: List[str]
    subject: str
    body: str
    metadata: EmailMetadata = field(default_factory=EmailMetadata)

    def is_valid(self) -> bool:
        """Check if email has all required fields."""
        return bool(
            self.uid and
            self.from_addr and
            self.to_addr and
            self.metadata.system
        )
        
    # Accessor methods for compatibility with existing code
    def get_system(self) -> str:
        """Get the system identifier."""
        return self.metadata.system
        
    def get_uid(self) -> int:
        """Get the email UID."""
        return self.uid

# Queue and health check types (keep these as they're used in main.py)
class EmailQueueStats(TypedDict):
    """Statistics about the email processing queue state."""
    size: int                  # Total queue size
    max_size: int             # Maximum queue capacity
    is_empty: bool            # Whether queue is empty
    is_processing: bool       # Whether queue is being processed
    # Fields below are maintained for backward compatibility but no longer track retries
    retry_count: int          # Always 0 (retry functionality removed)
    retry_ratio: float        # Always 0.0 (retry functionality removed)

class EmailHealthCheck(TypedDict):
    """Health check information for the email processing system."""
    running: bool             # Whether the system is running
    queue: EmailQueueStats    # Queue health information
    connection: Dict[str, Any]  # Connection health details
    metrics: Dict[str, Any]   # System-wide metrics
