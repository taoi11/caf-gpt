"""Email queue management and processing orchestration.
Handles:
- Email retrieval and queue population
- Processing loop
- Health monitoring and metrics collection
- Shutdown and cleanup operations
Provides end-to-end email processing workflow management."""

import asyncio
import imaplib
import socket
from datetime import datetime

from src.utils.logger import logger
from src.emails.parser import EmailParser
from src.emails.connection import IMAPConnection
from src.emails.queue import EmailQueue, QueueError
from src.types import EmailHealthCheck


class ProcessingError(Exception):
    """Custom exception for processing errors."""
    def __init__(self, message: str):
        super().__init__(message)


class QueueManager:
    """Manages email parsing and queueing."""

    def __init__(self):
        self.parser = EmailParser()
        self.connection = IMAPConnection()
        self.queue = EmailQueue(maxsize=100)
        self.running = False
        self._start_time = datetime.now()
        self._message_count = 0
        self._error_count = 0
        self._process_task = None  # Task for the processing loop

    async def start(self) -> None:
        """Start the queue manager."""
        if self.running:
            return

        self.running = True
        logger.info("Starting queue manager")

        # Initial connection
        if not self.connection.connect():
            logger.error("Failed to establish initial IMAP connection")
            self.running = False
            return

        # Start processing loop
        self._process_task = asyncio.create_task(self._processing_loop())

    async def stop(self) -> None:
        """Stop the queue manager and cleanup resources."""
        logger.info("Shutting down queue manager...")
        self.running = False

        # Cancel the processing loop task if running
        if self._process_task and not self._process_task.done():
            self._process_task.cancel()
            try:
                await self._process_task
            except asyncio.CancelledError:
                logger.debug("Processing loop cancelled")

        try:
            if self.connection.is_connected():
                self.connection.close()
            logger.info("Queue manager shutdown complete")
        except (imaplib.IMAP4.error, socket.error) as e:
            logger.error(f"Error during shutdown: {str(e)}")

    async def _processing_loop(self) -> None:
        """Main processing loop for fetching and queueing emails."""
        while self.running:
            try:
                # Ensure connection is active
                if not self.connection.is_connected():
                    if not self.connection.connect():
                        logger.error("Failed to reconnect to IMAP server")
                        await asyncio.sleep(5)  # Reduced wait time before retry
                        continue

                # Fetch and process new messages
                messages = self.connection.get_unread_messages()
                if messages:
                    self._message_count += len(messages)
                    logger.info(f"Retrieved {len(messages)} new messages")
                    
                    # Add messages to queue
                    for message in messages:
                        try:
                            await self.queue.add_email(message)
                            logger.debug(f"Queued message {message.uid} from {message.from_addr}")
                        except QueueError as e:
                            logger.error(f"Failed to queue message: {str(e)}")
                
                # Mark processed messages as read in IMAP
                processed_uids = self.queue.get_processed_uids()
                if processed_uids:
                    logger.info(f"Marking {len(processed_uids)} messages as read")
                    for uid in processed_uids:
                        # Assuming we need to get the appropriate mailbox for each message
                        # For now using a default mailbox value
                        self.connection.mark_as_read(uid, mailbox="INBOX")
                    self.queue.clear_processed_uids()  # Clear the processed UIDs

                # Allow other tasks to run and throttle polling - use shorter interval
                # for more responsive shutdown
                for _ in range(5):  # Check for shutdown every second
                    if not self.running:
                        break
                    await asyncio.sleep(1)
                
            except asyncio.CancelledError:
                logger.debug("Processing loop cancelled during operation")
                raise
            except (imaplib.IMAP4.error, socket.error) as e:
                self._error_count += 1
                logger.error(f"IMAP error: {str(e)}", metadata={
                    "error_count": self._error_count,
                    "retry_count": self.connection.retry_count if hasattr(self.connection, 'retry_count') else 0
                })
                await asyncio.sleep(2)  # Reduced wait time

    def get_health_check(self) -> EmailHealthCheck:
        """Get queue manager health status with metrics."""
        queue_stats = self.queue.get_stats()
        
        metrics = {
            "uptime_seconds": (datetime.now() - self._start_time).total_seconds(),
            "message_count": self._message_count,
            "error_count": self._error_count
        }
        
        connection_health = self.connection.get_health_check() if hasattr(self.connection, 'get_health_check') else {
            "connected": self.connection.is_connected(),
            "errors": self._error_count,
            "retry_count": getattr(self.connection, 'retry_count', 0)
        }
        
        return {
            "connection": connection_health,
            "queue": {
                "size": queue_stats["size"],
                "capacity": queue_stats["capacity"],
                "processing": queue_stats["processing"],
                "processed": queue_stats["processed"],
                "failed": queue_stats["failed"],
                "metrics": metrics
            }
        }
