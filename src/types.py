from typing import TypedDict, Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime

# Email types
@dataclass
class EmailMessage:
    """Represents an email in the processing queue."""
    raw_content: str  # Raw email string from IMAP
    parsed_content: Optional[Dict[str, Any]] = None  # Parsed email data
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
        self.metadata["retry_reason"] = reason
        self.metadata["retry_count"] = self.metadata.get("retry_count", 0) + 1

    def to_dict(self) -> Dict[str, Any]:
        """Convert the email to a dictionary for serialization."""
        return {
            "raw_content": self.raw_content,
            "parsed_content": self.parsed_content,
            "metadata": self.metadata
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "EmailMessage":
        """Create an EmailMessage from a dictionary."""
        return cls(
            raw_content=data["raw_content"],
            parsed_content=data.get("parsed_content"),
            metadata=data["metadata"]
        )

class EmailQueueStats(TypedDict):
    size: int
    max_size: int
    is_empty: bool
    is_processing: bool
    parsed_messages: int  # Number of messages with any parsed content
    valid_parsed: int    # Number of messages with valid parsed content
    parse_ratio: float   # Ratio of parsed to total messages

class EmailHealthCheck(TypedDict):
    running: bool
    queue: EmailQueueStats
    connection: Dict[str, Any]  # Connection health details

