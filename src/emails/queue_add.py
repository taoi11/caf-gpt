"""Module for parsing emails and adding them to the processing queue."""

import asyncio
import imaplib
import socket
from datetime import datetime

from src.utils.logger import logger
from src.emails.parser import EmailParser
from src.emails.connection import IMAPConnection
from src.emails.queue import EmailQueue
from src.types import EmailMessage, EmailHealthCheck


class ProcessingError(Exception):
    """Custom exception for processing errors that may need retry."""
    def __init__(self, message: str, is_retryable: bool = True):
        super().__init__(message)
        self.is_retryable = is_retryable


class QueueManager:
    """Manages email parsing and queueing with retry support."""

    def __init__(self):
        self.connection = IMAPConnection()
        self.queue = EmailQueue()
        self.running = False
        self._processed_uids = set()  # Track processed message UIDs
        self.parser = EmailParser()
        self._start_time = datetime.now()
        self._message_count = 0
        self._retry_count = 0
        self._error_count = 0

    async def start(self) -> None:
        """Start the email processor."""
        if self.running:
            return

        self.running = True
        logger.info("Starting email processor")

        # Initial connection
        if not self.connection.connect():
            logger.error("Failed to establish initial IMAP connection")
            self.running = False
            return

        # Start processing loop
        asyncio.create_task(self._processing_loop())

    async def stop(self) -> None:
        """Stop the email processor and cleanup resources."""
        logger.info("Shutting down email processor...")
        self.running = False

        try:
            if self.connection.is_connected():
                self.connection.close()
            logger.info("Email processor shutdown complete")
        except (imaplib.IMAP4.error, socket.error) as e:
            logger.error(f"Error during shutdown: {str(e)}")

    async def _process_message(self, message: EmailMessage) -> None:
        """Process a single email message with retry support.
        
        Args:
            message: Email message to process
        """
        try:
            # Simulate processing (replace with actual processing logic)
            await asyncio.sleep(1)  # Placeholder for actual processing
            
            # Record success metrics
            if message.retry_count > 0:
                self._retry_count += 1
                logger.info("Successfully processed message after retry", metadata={
                    "uid": message.uid,
                    "retry_count": message.retry_count,
                    "system": message.system
                })
            
            self._message_count += 1

        except ProcessingError as e:
            if e.is_retryable and message.should_retry():
                message.mark_retry()
                logger.warn("Scheduling message for retry", metadata={
                    "uid": message.uid,
                    "retry_count": message.retry_count,
                    "error": str(e)
                })
                await self.queue.put(message)
            else:
                self._error_count += 1
                logger.error("Message processing failed", metadata={
                    "uid": message.uid,
                    "retry_count": message.retry_count,
                    "error": str(e),
                    "is_retryable": e.is_retryable
                })
        except (ValueError, RuntimeError) as e:
            self._error_count += 1
            logger.error("Unexpected error processing message", metadata={
                "uid": message.uid,
                "retry_count": message.retry_count,
                "error": str(e),
                "error_type": type(e).__name__
            })

    async def _processing_loop(self) -> None:
        """Main processing loop with retry support."""
        while self.running:
            try:
                # Get new messages
                messages = self.connection.get_unread_messages()
                if not messages:
                    await asyncio.sleep(5)
                    continue

                # Filter out already processed messages
                new_messages = [
                    msg for msg in messages
                    if msg.uid not in self._processed_uids
                ]

                if new_messages:
                    # Add valid messages to queue
                    valid_messages = [
                        msg for msg in new_messages
                        if msg.is_valid()
                    ]

                    if valid_messages:
                        for msg in valid_messages:
                            self.queue.put(msg)
                            logger.debug("Added message to queue", metadata={
                                "uid": msg.uid,
                                "system": msg.system,
                                "from": msg.from_addr
                            })

                        # Process messages
                        for msg in valid_messages:
                            await self._process_message(msg)
                            self._processed_uids.add(msg.uid)

                await asyncio.sleep(5)

            except (imaplib.IMAP4.error, socket.error) as e:
                logger.error("IMAP error in processing loop", metadata={
                    "error": str(e),
                    "retry_count": self.connection.retry_count
                })
                await asyncio.sleep(5)

    def get_health_check(self) -> EmailHealthCheck:
        """Get processor health status with metrics."""
        queue_stats = self.queue.get_stats()
        
        metrics = {
            "uptime_seconds": (datetime.now() - self._start_time).total_seconds(),
            "message_count": self._message_count,
            "retry_count": self._retry_count,
            "error_count": self._error_count,
            "success_rate": (
                (self._message_count - self._error_count) / self._message_count 
                if self._message_count > 0 else 0
            )
        }
        
        return {
            "running": self.running,
            "queue": queue_stats,
            "connection": self.connection.get_health_check(),
            "metrics": metrics
        }
