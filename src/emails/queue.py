"""Thread-safe email processing queue with monitoring support.
Implements a clean, async-friendly queue for email message processing with:
- Thread-safe operations with lock management
- Comprehensive queue statistics 
- Simple interface for adding and retrieving messages
"""

from typing import Optional, List, Set, Dict, Any
import threading
import asyncio

from src.utils.logger import logger
from src.types import EmailMessage, EmailQueueStats

class QueueError(Exception):
    """Custom exception for queue-related errors."""

class EmailQueue:
    """Thread-safe queue for email processing."""
    
    def __init__(self, maxsize: int = 100):
        """Initialize the email queue.
        
        Args:
            maxsize: Maximum queue size (default: 100)
        """
        self._queue = asyncio.Queue(maxsize=maxsize)
        self._lock = threading.Lock()
        self._processed_uids: Set[int] = set()  # Track processed UIDs
        
    async def add_email(self, email: EmailMessage) -> bool:
        """Add an email to the queue.
        
        Args:
            email: Email message to add
            
        Returns:
            bool: True if added successfully, False if queue is full
        """
        async with asyncio.locks.Lock():  # Async lock for better async support
            if self._queue.full():
                logger.warn(
                    "Queue is full, dropping email",
                    metadata={
                        "uid": email.get_uid(),
                        "system": email.get_system()
                    }
                )
                return False
            
            # Check for duplicate UID
            if email.get_uid() in self._processed_uids:
                logger.debug(
                    "Skipping duplicate email",
                    metadata={
                        "uid": email.get_uid(),
                        "system": email.get_system()
                    }
                )
                return False
            
            # Add to queue
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
        """Add multiple emails to queue.
        
        Args:
            emails: List of email messages to add
            
        Returns:
            int: Number of emails successfully added
        """
        added = 0
        for email in emails:
            if await self.add_email(email):
                added += 1
        return added

    async def get(self) -> Optional[EmailMessage]:
        """Get next email from queue.
        
        Returns:
            EmailMessage or None if queue is empty
        """
        try:
            return await self._queue.get()
        except asyncio.QueueEmpty:
            return None
            
    def task_done(self, email: EmailMessage) -> None:
        """Mark task as done and track processed UID.
        
        Args:
            email: Processed email message
        """
        # Track the UID to avoid reprocessing
        self._processed_uids.add(email.get_uid())
        # Mark task as done in the queue
        self._queue.task_done()
        logger.debug(
            "Marked email as processed",
            metadata={
                "uid": email.get_uid(),
                "system": email.get_system(),
                "queue_size": self._queue.qsize()
            }
        )

    async def empty(self) -> bool:
        """Check if queue is empty.
        
        Returns:
            bool: True if empty, False otherwise
        """
        return self._queue.empty()
        
    def get_size(self) -> int:
        """Get current queue size.
        
        Returns:
            int: Current queue size
        """
        return self._queue.qsize()
        
    async def clear(self) -> None:
        """Clear the queue completely."""
        while not await self.empty():
            try:
                email = await self.get()
                if email:
                    self._queue.task_done()
            except (asyncio.QueueEmpty, Exception) as e:
                logger.error(f"Error clearing queue: {str(e)}")
                break
        
        logger.info("Queue cleared")
        
    def get_stats(self) -> EmailQueueStats:
        """Get queue statistics.
        
        Returns:
            EmailQueueStats: Queue statistics
        """
        return {
            "size": self._queue.qsize(),
            "max_size": self._queue.maxsize,
            "is_empty": self._queue.empty(),
            "is_processing": not self._queue.empty(),
            # Fields below are maintained for backward compatibility
            "retry_count": 0,  # Retry functionality removed
            "retry_ratio": 0.0  # Retry functionality removed
        }

    def start_processing(self) -> bool:
        """Mark queue as processing. Returns False if already processing."""
        with self._lock:
            if not self._queue.empty():
                return False
            return True

    async def stop_processing(self) -> None:
        """Mark queue as not processing."""
        with self._lock:
            while not self._queue.empty():
                email = await self._queue.get()
                if email:
                    self._queue.task_done()

    def is_processing(self) -> bool:
        """Check if queue is currently being processed."""
        return not self._queue.empty()

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
        with self._lock:
            return set(self._processed_uids)  # Return a copy
            
    def clear_processed_uids(self) -> None:
        """Clear the set of processed UIDs."""
        with self._lock:
            self._processed_uids.clear()
