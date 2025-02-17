"""Type definitions for the application."""

from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from typing import TypedDict, Dict, Optional, Any

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
class EmailRetryState:
    """Represents the retry state of an email."""
    attempt_count: int = 0
    last_attempt: Optional[datetime] = None
    next_attempt: Optional[datetime] = None
    failure_reason: Optional[str] = None
    max_attempts: int = 3

    def should_retry(self) -> bool:
        """Determine if the email should be retried based on attempt count and timing."""
        if self.attempt_count >= self.max_attempts:
            return False
        if self.next_attempt is None:
            return True
        return datetime.now() >= self.next_attempt

    def calculate_next_attempt(self) -> datetime:
        """Calculate next attempt time using exponential backoff."""
        # Base delay is 5 seconds, doubles each attempt (5, 10, 20, etc.)
        delay_seconds = 5 * (2 ** self.attempt_count)
        return datetime.now().replace(microsecond=0) + timedelta(seconds=delay_seconds)

    def record_attempt(self, failure_reason: Optional[str] = None) -> None:
        """Record a retry attempt."""
        self.attempt_count += 1
        self.last_attempt = datetime.now().replace(microsecond=0)
        self.failure_reason = failure_reason
        self.next_attempt = self.calculate_next_attempt() if self.should_retry() else None

@dataclass
class EmailMessage:
    """Represents an email in the processing queue."""
    raw_content: str  # Raw email string from IMAP
    parsed_content: Optional[Dict[str, Any]] = None  # Parsed email data
    metadata: Dict[str, Any] = field(default_factory=dict)  # Routing and processing metadata
    retry_state: EmailRetryState = field(default_factory=EmailRetryState)  # Retry tracking

    def get_system(self) -> Optional[str]:
        """Get the target system for this email."""
        return self.metadata.get("system")

    def get_uid(self) -> Optional[int]:
        """Get the IMAP UID for this email."""
        return self.metadata.get("uid")

    def get_received_at(self) -> Optional[datetime]:
        """Get the timestamp when the email was received."""
        return self.metadata.get("received_at")

    def has_valid_parsed_content(self) -> bool:
        """Check if parsed content has required fields."""
        if not self.parsed_content:
            return False
        return all(
            key in self.parsed_content
            for key in ["subject", "body", "from", "to"]
        )

    def is_valid(self) -> bool:
        """Validate that the email has required metadata."""
        return all(
            key in self.metadata
            for key in ["system", "uid", "received_at"]
        )

    def mark_for_retry(self, reason: str) -> None:
        """Mark this email for retry processing."""
        self.retry_state.record_attempt(reason)

    def should_retry(self) -> bool:
        """Check if the email should be retried."""
        return self.retry_state.should_retry()

    def get_retry_count(self) -> int:
        """Get the number of retry attempts."""
        return self.retry_state.attempt_count

    def get_next_retry_time(self) -> Optional[datetime]:
        """Get the next scheduled retry time."""
        return self.retry_state.next_attempt

    def to_dict(self) -> Dict[str, Any]:
        """Convert the email to a dictionary for serialization."""
        return {
            "raw_content": self.raw_content,
            "parsed_content": self.parsed_content,
            "metadata": self.metadata,
            "retry_state": asdict(self.retry_state)
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "EmailMessage":
        """Create an EmailMessage from a dictionary."""
        retry_state = EmailRetryState(**data.get("retry_state", {}))
        return cls(
            raw_content=data["raw_content"],
            parsed_content=data.get("parsed_content"),
            metadata=data["metadata"],
            retry_state=retry_state
        )

class MetricsMetadata(TypedDict):
    """Metadata for tracking system metrics."""
    retry_stats: Dict[str, Any]  # Retry-related statistics
    health: Dict[str, Any]      # Health check data

class RetryMetrics(TypedDict):
    """Metrics specific to retry operations."""
    total_retries: int          # Total number of retry attempts
    success_rate: float         # Successful retries / total retries
    avg_attempts: float         # Average attempts before success
    failure_reasons: Dict[str, int]  # Count of each failure reason
    backoff_stats: Dict[str, Any]    # Statistics about backoff times

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
    metrics: MetricsMetadata  # System-wide metrics
