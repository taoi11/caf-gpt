"""Thread-safe queue implementation for email processing."""

from collections import deque
from typing import Optional, List, Set
import threading
import asyncio
from datetime import datetime

from src.utils.logger import logger
from src.types import EmailMessage, EmailQueueStats

class EmailQueue:
    """Thread-safe queue for email processing with retry support."""
    
    def __init__(self, maxlen: int = 100):
        self.queue = deque(maxlen=maxlen)
        self.retry_queue = deque(maxlen=maxlen)  # Separate queue for retry items
        self.lock = threading.Lock()
        self._processing = False
        self._retry_task: Optional[asyncio.Task] = None
        self._processed_uids: Set[int] = set()  # Track processed UIDs
        self._stop_retry_processing = False

    async def _delayed_add(self, email: EmailMessage) -> None:
        """Async method to handle delayed retry of emails."""
        next_attempt = email.get_next_retry_time()
        if not next_attempt:
            logger.warn("No retry time set for email", metadata={
                "uid": email.get_uid(),
                "retry_count": email.get_retry_count()
            })
            return

        # Calculate sleep duration
        now = datetime.now().replace(microsecond=0)
        sleep_duration = (next_attempt - now).total_seconds()
        
        if sleep_duration > 0:
            try:
                logger.info("Scheduling retry", metadata={
                    "uid": email.get_uid(),
                    "retry_count": email.get_retry_count(),
                    "delay_seconds": sleep_duration
                })
                await asyncio.sleep(sleep_duration)
                
                # Check if we should still process this retry
                if self._stop_retry_processing:
                    logger.info("Retry processing stopped, cancelling retry", metadata={
                        "uid": email.get_uid()
                    })
                    return

                # Add to main queue for processing
                if self.add_email(email):
                    logger.info("Retry email added to queue", metadata={
                        "uid": email.get_uid(),
                        "retry_count": email.get_retry_count()
                    })
                else:
                    logger.error("Failed to add retry email to queue", metadata={
                        "uid": email.get_uid(),
                        "retry_count": email.get_retry_count()
                    })
            except asyncio.CancelledError:
                logger.info("Retry task cancelled", metadata={
                    "uid": email.get_uid()
                })
                raise

    def add_email(self, email: EmailMessage) -> bool:
        """Add an email to the queue. Returns False if queue is full."""
        with self.lock:
            # Check if this is a retry
            is_retry = email.get_retry_count() > 0
            target_queue = self.retry_queue if is_retry else self.queue

            if len(target_queue) >= target_queue.maxlen:
                logger.warn(
                    "Queue is full, dropping email",
                    metadata={
                        "uid": email.get_uid(),
                        "is_retry": is_retry,
                        "retry_count": email.get_retry_count()
                    }
                )
                return False
            
            target_queue.append(email)
            logger.debug(
                "Added email to queue",
                metadata={
                    "uid": email.get_uid(),
                    "system": email.get_system(),
                    "queue_size": len(target_queue),
                    "is_retry": is_retry,
                    "retry_count": email.get_retry_count()
                }
            )
            return True

    def add_emails(self, emails: List[EmailMessage]) -> int:
        """Add multiple emails to queue. Returns number of emails added."""
        added = 0
        for email in emails:
            if self.add_email(email):
                added += 1
        return added

    def get_next_email(self) -> Optional[EmailMessage]:
        """Get the next email from the queue, prioritizing retries."""
        with self.lock:
            try:
                # First check retry queue
                if self.retry_queue:
                    return self.retry_queue.popleft()
                # Then check main queue
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
        """Get queue statistics including retry information."""
        with self.lock:
            total_messages = len(self.queue) + len(self.retry_queue)
            retry_messages = len(self.retry_queue)
            
            return {
                "size": total_messages,
                "max_size": self.queue.maxlen,
                "is_empty": total_messages == 0,
                "is_processing": self._processing,
                "retry_count": retry_messages,
                "retry_ratio": retry_messages / total_messages if total_messages > 0 else 0
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

    def schedule_retry(self, email: EmailMessage, reason: str) -> None:
        """Schedule an email for retry with exponential backoff."""
        email.mark_for_retry(reason)
        
        if email.should_retry():
            # Create task for delayed add
            loop = asyncio.get_event_loop()
            retry_task = loop.create_task(self._delayed_add(email))
            
            # Store task reference to allow cancellation
            self._retry_task = retry_task
            
            logger.info("Scheduled email for retry", metadata={
                "uid": email.get_uid(),
                "retry_count": email.get_retry_count(),
                "reason": reason,
                "next_attempt": email.get_next_retry_time()
            })
        else:
            logger.warn("Email exceeded retry limit", metadata={
                "uid": email.get_uid(),
                "retry_count": email.get_retry_count(),
                "reason": reason
            })

    def stop_retry_processing(self) -> None:
        """Stop processing retries and cancel any pending retry tasks."""
        self._stop_retry_processing = True
        if self._retry_task and not self._retry_task.done():
            self._retry_task.cancel()
