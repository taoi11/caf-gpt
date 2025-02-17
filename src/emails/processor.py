"""Email processing module for handling incoming messages."""

import asyncio
import imaplib
import socket
from typing import Dict, Any

from src.utils.logger import logger
from src.emails.parser import EmailParser
from src.emails.connection import IMAPConnection
from src.emails.queue import EmailQueue


class EmailProcessor:
    """Manages email processing workflow."""

    def __init__(self):
        self.connection = IMAPConnection()
        self.queue = EmailQueue()
        self.running = False
        self._processed_uids = set()  # Track processed message UIDs
        self.parser = EmailParser()

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

    async def _processing_loop(self) -> None:
        """Main processing loop for fetching and queueing emails."""
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
                    if msg.get_uid() not in self._processed_uids
                ]

                if new_messages:
                    # Add valid messages to queue
                    valid_messages = [
                        msg for msg in new_messages
                        if msg.has_valid_parsed_content()
                    ]

                    if valid_messages:
                        added = self.queue.add_emails(valid_messages)
                        logger.info(f"Added {added} messages to queue")

                        # Track processed messages
                        for msg in valid_messages:
                            self._processed_uids.add(msg.get_uid())
                            logger.debug("Processed email", metadata={
                                "uid": msg.get_uid(),
                                "system": msg.get_system()
                            })

                await asyncio.sleep(5)

            except (imaplib.IMAP4.error, socket.error) as e:
                logger.error(f"IMAP error in processing loop: {str(e)}", metadata={
                    "retry_count": self.connection.retry_count
                })
                await asyncio.sleep(5)

    def get_health_check(self) -> Dict[str, Any]:
        """Get processor health status."""
        return {
            "running": self.running,
            "queue": self.queue.get_stats(),
            "connection": self.connection.get_health_check()
        }
