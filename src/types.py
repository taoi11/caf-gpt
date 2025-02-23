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
class EmailMessage:
    """Represents a parsed email message."""
    uid: int
    from_addr: str
    to_addr: List[str]
    subject: str
    body: str
    system: str
    received_at: datetime = field(default_factory=datetime.now)
    retry_count: int = 0

    def is_valid(self) -> bool:
        """Check if email has all required fields."""
        return bool(
            self.uid and
            self.from_addr and
            self.to_addr and
            self.system
        )

    def should_retry(self) -> bool:
        """Check if email should be retried based on attempt count."""
        return self.retry_count < 3  # Max 3 attempts

    def mark_retry(self) -> None:
        """Increment retry counter."""
        self.retry_count += 1

# Queue and health check types (keep these as they're used in main.py)
class EmailQueueStats(TypedDict):
    """Statistics about the email processing queue state."""
    size: int                  # Total queue size
    max_size: int             # Maximum queue capacity
    is_empty: bool            # Whether queue is empty
    is_processing: bool       # Whether queue is being processed
    retry_count: int          # Number of messages in retry state
    retry_ratio: float        # Ratio of retry messages to total

class EmailHealthCheck(TypedDict):
    """Health check information for the email processing system."""
    running: bool             # Whether the system is running
    queue: EmailQueueStats    # Queue health information
    connection: Dict[str, Any]  # Connection health details
    metrics: Dict[str, Any]   # System-wide metrics
