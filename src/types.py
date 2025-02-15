from typing import TypedDict, Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime

# Email types
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

class EmailQueueStats(TypedDict):
    size: int
    max_size: int
    is_empty: bool
    is_processing: bool

class EmailHealthCheck(TypedDict):
    running: bool
    queue: EmailQueueStats
    connection: Dict[str, Any]  # Connection health details

