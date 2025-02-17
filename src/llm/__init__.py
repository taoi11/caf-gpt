"""LLM routing and processing module."""

import asyncio
from typing import Optional

from src.utils.logger import logger
from src.types import EmailMessage
from src.llm.pace_note import PaceNoteHandler
from src.emails.queue import EmailQueue


class LLMRouter:
    """Routes emails to appropriate LLM handlers."""
    def __init__(self):
        self.pace_note = PaceNoteHandler()
        self.queue: Optional[EmailQueue] = None
        self.running = False
        self._process_task: Optional[asyncio.Task] = None
        
    def start_watching(self, queue: EmailQueue) -> None:
        """Start watching the email queue for messages to process."""
        self.queue = queue
        self.running = True
        
        # Start processing loop
        self._process_task = asyncio.create_task(self._process_queue())
        logger.info("LLM Router now watching email queue")
        
    async def stop(self) -> None:
        """Stop the router and cleanup resources."""
        logger.info("Shutting down LLM Router...")
        self.running = False
        
        if self._process_task:
            try:
                # Cancel the task and wait for it to complete
                self._process_task.cancel()
                await self._process_task
            except asyncio.CancelledError:
                pass  # Expected during shutdown
            self._process_task = None
        
        logger.info("LLM Router shutdown complete")
        
    async def _process_queue(self) -> None:
        """Continuously process emails from queue."""
        while self.running:
            try:
                if not self.queue or self.queue.is_empty():
                    logger.debug("Queue is empty")
                    await asyncio.sleep(1)
                    continue

                logger.debug("Queue not empty, getting next email")
                email = self.queue.get_next_email()
                if email:
                    logger.debug("Got email from queue", metadata={
                        "system": email.get_system(),
                        "uid": email.get_uid()
                    })
                    self.route_email(email)
                else:
                    logger.debug("Got None from queue")
                
                # Wait before next check
                await asyncio.sleep(1)
                
            except asyncio.CancelledError:
                logger.debug("LLM Router queue processing cancelled")
                raise  # Re-raise to properly handle task cancellation
            except Exception as e:
                logger.exception(f"Error processing queue: {str(e)}")
                await asyncio.sleep(1)
        
    def route_email(self, email: EmailMessage) -> None:
        """Route email to appropriate handler based on system.
        
        Args:
            email: The email message to route to appropriate handler
        """
        logger.debug("LLM Router received email", {
            "system": email.get_system(),
            "uid": email.get_uid(),
            "metadata": email.metadata,
            "content_preview": email.raw_content[:100]
        })
        
        if email.get_system() == "pace_notes":
            logger.debug("Routing to PaceNote handler")
            self.pace_note.process(email)
        else:
            logger.warn("Unknown system for email", metadata={
                "system": email.get_system(),
                "uid": email.get_uid()
            })
