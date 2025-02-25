"""Thread-safe email processing queue with monitoring support.
Implements:
- Asynchronous queue operations 
- Queue statistics and health monitoring
- Thread-safe operations with lock management
Provides robust email processing."""

from typing import Optional, List, Set
import threading
import asyncio

from src.utils.logger import logger
from src.types import EmailMessage, EmailQueueStats

class QueueError(Exception):
    """Custom exception for queue-related errors."""

class EmailQueue:
    """Thread-safe queue for email processing."""
    
    def __init__(self, maxsize: int = 1000):
        self._queue = asyncio.Queue(maxsize=maxsize)
        self.lock = threading.Lock()
        self._processing = False
        self._processed_uids: Set[int] = set()  # Track processed UIDs

    async def add_email(self, email: EmailMessage) -> bool:
        """Add an email to the queue. Returns False if queue is full."""
        with self.lock:
            if self._queue.full():
                logger.warn(
                    "Queue is full, dropping email",
                    metadata={
                        "uid": email.get_uid(),
                        "system": email.get_system()
                    }
                )
                return False
            
            # Make sure to await the put coroutine
            await self._queue.put(email)
            logger.debug(
                "Added email to queue",
                metadata={
                    "uid": email.get_uid(),
                    "system": email.get_system(),
                    "queue_size": self._queue.qsize()
                }
            )
            return True

    async def add_emails(self, emails: List[EmailMessage]) -> int:
        """Add multiple emails to queue. Returns number of emails added."""
        added = 0
        for email in emails:
            if await self.add_email(email):
                added += 1
        return added

    async def get(self) -> Optional[EmailMessage]:
        """Get next email from queue."""
        try:
            return await self._queue.get()
        except asyncio.QueueEmpty:
            return None

    def peek_next_email(self) -> Optional[EmailMessage]:
        """Peek at the next email without removing it."""
        with self.lock:
            return self._queue.queue[0] if not self._queue.empty() else None

    def empty(self) -> bool:
        """Check if queue is empty."""
        with self.lock:
            return self._queue.empty()

    def get_size(self) -> int:
        """Get current queue size."""
        with self.lock:
            return self._queue.qsize()

    def clear(self) -> None:
        """Clear all emails from the queue."""
        with self.lock:
            self._queue.queue.clear()

    def get_stats(self) -> EmailQueueStats:
        """Get queue statistics."""
        with self.lock:
            total_messages = self._queue.qsize()
            
            return {
                "size": total_messages,
                "max_size": self._queue.maxsize,
                "capacity": self._queue.maxsize,  # Alias for max_size for backward compatibility
                "is_empty": total_messages == 0,
                "is_processing": self._processing,
                "retry_count": 0,  # No more retry functionality
                "retry_ratio": 0,  # No more retry functionality
                "processing": self._processing,  # Alias for is_processing
                "processed": len(self._processed_uids),
                "failed": 0  # No tracking of failed messages
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

    async def put(self, email: EmailMessage) -> None:
        """Add email to queue.
        
        Args:
            email: Email message to add to queue
            
        Raises:
            QueueError: If queue is full or other error occurs
        """
        try:
            await self._queue.put(email)
        except asyncio.QueueFull as exc:
            raise QueueError("Queue is full") from exc
        except Exception as e:
            raise QueueError(f"Error adding to queue: {str(e)}") from e

    def get_processed_uids(self) -> Set[int]:
        """Get the set of processed UIDs."""
        with self.lock:
            return set(self._processed_uids)  # Return a copy
            
    def clear_processed_uids(self) -> None:
        """Clear the set of processed UIDs."""
        with self.lock:
            self._processed_uids.clear()
