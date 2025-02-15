import asyncio
from typing import Optional, Callable
from datetime import datetime
import time

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
        self._processed_uids = set()  # Track processed message UIDs
        
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
        """Stop the email processor and cleanup resources."""
        logger.info("Shutting down email processor...")
        
        # Set running to false to stop processing loop
        self.running = False
        
        try:
            # Wait for current processing to complete
            if self.queue.is_processing():
                logger.info("Waiting for current processing to complete...")
                await asyncio.sleep(1)
            
            # Close IMAP connection if it exists
            if self.connection.is_connected():
                logger.debug("Closing IMAP connection...")
                self.connection.close()
            
            logger.info("Email processor shutdown complete")
            
        except Exception as e:
            logger.error(f"Error during shutdown: {str(e)}")

    async def _processing_loop(self) -> None:
        # Main processing loop.
        while self.running:
            try:
                # Get new messages
                messages = self.connection.get_unread_messages()
                if messages:
                    # Filter out already processed messages
                    new_messages = [
                        msg for msg in messages 
                        if msg.get_uid() not in self._processed_uids
                    ]
                    
                    if new_messages:
                        added = self.queue.add_emails(new_messages)
                        logger.info(f"Added {added} new messages to queue")
                        
                        # Track the new messages
                        for msg in new_messages:
                            self._processed_uids.add(msg.get_uid())

                # Process queue
                if not self.queue.is_empty():
                    await self._process_queue()

                # Wait before next check
                await asyncio.sleep(5)

            except Exception as e:
                logger.error(f"Error in processing loop: {str(e)}")
                await asyncio.sleep(5)

    async def _process_queue(self) -> None:
        # Process emails in the queue.
        if not self.queue.start_processing():
            return

        try:
            while not self.queue.is_empty() and self.running:
                email = self.queue.get_next_email()
                if not email:
                    continue

                try:
                    system = email.get_system()
                    folder = email.metadata.get("folder")
                    
                    if not folder:
                        logger.error("Email missing folder information")
                        continue

                    # Process based on system type
                    if system == "pace_notes":
                        # TODO: Implement pace notes processing
                        logger.info(f"Processing pace notes email {email.get_uid()}")
                        pass
                    elif system == "policy_foo":
                        # TODO: Implement policy foo processing
                        logger.info(f"Processing policy foo email {email.get_uid()}")
                        pass
                    else:
                        logger.warn(f"Unknown system type: {system}")
                        continue

                    # Note: Removed mark-as-read - will be done after full processing

                except Exception as e:
                    logger.error(f"Error processing email: {str(e)}")
                    email.mark_for_retry(str(e))
                    self.queue.add_email(email)

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