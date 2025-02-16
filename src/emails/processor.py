import asyncio
from typing import Optional, Callable
from datetime import datetime
import time

from src.utils.logger import logger
from src.types import EmailMessage, EmailHealthCheck
from .connection import IMAPConnection
from .queue import EmailQueue
from src.emails.parser import EmailParser

class EmailProcessor:
    # Manages email processing workflow.
    
    def __init__(self):
        self.connection = IMAPConnection()
        self.queue = EmailQueue()
        self.running = False
        self._process_lock = asyncio.Lock()
        self._processed_uids = set()  # Track processed message UIDs
        self.parser = EmailParser()
        
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
        """Main processing loop for adding parsed emails to queue."""
        while self.running:
            try:
                # Get new messages (already parsed by IMAPConnection)
                messages = self.connection.get_unread_messages()
                if messages:
                    # Filter out already processed messages
                    new_messages = [
                        msg for msg in messages 
                        if msg.get_uid() not in self._processed_uids
                    ]
                    
                    if new_messages:
                        # Ensure all messages have valid parsed content
                        valid_messages = []
                        for msg in new_messages:
                            if not msg.parsed_content:
                                try:
                                    msg.parsed_content = self.parser.parse_email(
                                        msg.raw_content.encode('utf-8')
                                    )
                                except Exception as e:
                                    logger.error(f"Error parsing email: {str(e)}")
                                    continue

                            if msg.has_valid_parsed_content():
                                valid_messages.append(msg)
                                logger.debug(f"Added email to queue", metadata={
                                    "uid": msg.get_uid(),
                                    "system": msg.get_system()
                                })
                            else:
                                logger.warn("Invalid parsed content", extra={
                                    "uid": msg.get_uid()
                                })

                        # Add valid parsed messages to queue
                        if valid_messages:
                            added = self.queue.add_emails(valid_messages)
                            logger.info(f"Added {added} parsed messages to queue")
                            
                            # Track the new messages
                            for msg in valid_messages:
                                self._processed_uids.add(msg.get_uid())

                # Wait before next check
                await asyncio.sleep(5)

            except Exception as e:
                logger.error(f"Error in processing loop: {str(e)}", metadata={
                    "retry_count": self.connection.retry_count
                })
                await asyncio.sleep(5)

    async def _process_queue(self) -> None:
        """
        Queue processing is handled by the LLM module.
        This is just a placeholder to document the design.
        """
        pass

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