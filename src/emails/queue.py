"""Thread-safe queue implementation for email processing."""

from collections import deque
from typing import Optional, List
import threading

from src.utils.logger import logger
from src.types import EmailMessage, EmailQueueStats

class EmailQueue:
    """Thread-safe queue for email processing."""
    
    def __init__(self, maxlen: int = 100):
        self.queue = deque(maxlen=maxlen)
        self.lock = threading.Lock()
        self._processing = False

    def add_email(self, email: EmailMessage) -> bool:
        """Add an email to the queue. Returns False if queue is full."""
        with self.lock:
            if len(self.queue) >= self.queue.maxlen:
                logger.warn("Queue is full, dropping email", metadata={
                    "uid": email.get_uid()
                })
                return False
                
            self.queue.append(email)
            logger.debug("Added email to queue", metadata={
                "uid": email.get_uid(),
                "system": email.get_system(),
                "queue_size": len(self.queue)
            })
            return True

    def add_emails(self, emails: List[EmailMessage]) -> int:
        """Add multiple emails to queue. Returns number of emails added."""
        added = 0
        for email in emails:
            if self.add_email(email):
                added += 1
        return added

    def get_next_email(self) -> Optional[EmailMessage]:
        """Get the next email from the queue."""
        with self.lock:
            try:
                return self.queue.popleft() if self.queue else None
            except IndexError:
                return None

    def peek_next_email(self) -> Optional[EmailMessage]:
        """Peek at the next email without removing it."""
        with self.lock:
            return self.queue[0] if self.queue else None

    def is_empty(self) -> bool:
        """Check if the queue is empty."""
        with self.lock:
            return len(self.queue) == 0

    def get_size(self) -> int:
        """Get current queue size."""
        with self.lock:
            return len(self.queue)

    def clear(self) -> None:
        """Clear all emails from the queue."""
        with self.lock:
            self.queue.clear()

    def get_stats(self) -> EmailQueueStats:
        """Get queue statistics including parsed message tracking."""
        with self.lock:
            total_messages = len(self.queue)
            parsed_messages = sum(1 for msg in self.queue if msg.parsed_content)
            valid_parsed = sum(1 for msg in self.queue if msg.has_valid_parsed_content())
            
            return {
                "size": total_messages,
                "max_size": self.queue.maxlen,
                "is_empty": total_messages == 0,
                "is_processing": self._processing,
                "parsed_messages": parsed_messages,
                "valid_parsed": valid_parsed,
                "parse_ratio": parsed_messages / total_messages if total_messages > 0 else 0
            }

    def start_processing(self) -> bool:
        """Mark queue as processing. Returns False if already processing."""
        with self.lock:
            if self._processing:
                return False
            self._processing = True
            return True

    def stop_processing(self) -> None:
        """Mark queue as not processing."""
        with self.lock:
            self._processing = False

    def is_processing(self) -> bool:
        """Check if queue is currently being processed."""
        with self.lock:
            return self._processing
