import asyncio
from typing import Optional, Callable
from datetime import datetime

from src.utils.logger import logger
from src.types import EmailMessage, EmailHealthCheck
from .connection import IMAPConnection
from .queue import EmailQueue

class EmailProcessor:
    # Manages email processing workflow.
    
    def __init__(self):
        self.connection = IMAPConnection()
        self.queue = EmailQueue()
        self.running = False
        self._process_lock = asyncio.Lock()
        
    async def start(self) -> None:
        # Start the email processor.
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
        # Stop the email processor.
        self.running = False
        logger.info("Stopping email processor")

    async def _processing_loop(self) -> None:
        # Main processing loop.
        while self.running:
            try:
                # Check connection health
                if not self.connection.is_healthy:
                    await self._handle_unhealthy_connection()
                    continue

                # Get new messages
                messages = self.connection.get_unread_messages()
                if messages:
                    added = self.queue.add_emails(messages)
                    logger.info(f"Added {added} new messages to queue")

                # Process queue
                if not self.queue.is_empty():
                    await self._process_queue()

                # Wait before next check
                await asyncio.sleep(5)  # Adjust as needed

            except Exception as e:
                logger.error(f"Error in processing loop: {str(e)}")
                await asyncio.sleep(5)  # Back off on error

    async def _process_queue(self) -> None:
        # Process emails in the queue.
        if not self.queue.start_processing():
            return  # Already processing

        try:
            while not self.queue.is_empty() and self.running:
                email = self.queue.get_next_email()
                if not email:
                    continue

                try:
                    # Process based on system type
                    system = email.get_system()
                    if system == "pace_notes":
                        # TODO: Implement pace notes processing
                        pass
                    elif system == "policy_foo":
                        # TODO: Implement policy foo processing
                        pass
                    else:
                        logger.warn(f"Unknown system type: {system}")
                        continue

                    # Mark as read after successful processing
                    if self.connection.mark_as_read(email.get_uid()):
                        logger.info(f"Successfully processed email", {
                            "uid": email.get_uid(),
                            "system": system
                        })
                    else:
                        email.mark_for_retry("Failed to mark as read")
                        self.queue.add_email(email)  # Re-queue for retry

                except Exception as e:
                    logger.error(f"Error processing email: {str(e)}")
                    email.mark_for_retry(str(e))
                    self.queue.add_email(email)  # Re-queue for retry

        finally:
            self.queue.stop_processing()

    async def _handle_unhealthy_connection(self) -> None:
        # Handle unhealthy connection state.
        logger.warn("Connection unhealthy, attempting reconnect")
        if not self.connection.connect():
            await asyncio.sleep(min(300, 2 ** self.connection.retry_count))  # Exponential backoff

    def get_health_check(self) -> dict:
        # Get processor health status.
        return {
            "running": self.running,
            "queue": self.queue.get_stats(),
            "connection": self.connection.get_health_check()
        } 