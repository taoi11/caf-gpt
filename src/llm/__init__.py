"""LLM routing and processing module."""

import asyncio
from typing import Optional, Union
from src.utils.logger import logger
from src.types import EmailMessage
from src.llm.pace_note import PaceNoteHandler
from src.emails.queue import EmailQueue, QueueError


class LLMRouter:
    """Routes emails to appropriate LLM handlers based on system type."""
    
    def __init__(self):
        self.pace_note = PaceNoteHandler()
        self.queue: Optional[EmailQueue] = None
        self.running = False
        self._process_task: Optional[asyncio.Task] = None
        
    def start_watching(self, queue: EmailQueue) -> None:
        """Start watching the email queue for messages to process.
        
        Args:
            queue: Queue to watch for new messages
        """
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
                if not self.queue or self.queue.empty():
                    await asyncio.sleep(1)
                    continue

                # Get next email from queue
                email = await self.queue.get()
                if email:
                    logger.debug("Processing email from queue", metadata={
                        "system": email.system,
                        "uid": email.uid,
                        "from": email.from_addr
                    })
                    await self.route_email(email)
                
                # Wait before next check
                await asyncio.sleep(1)
                
            except asyncio.CancelledError:
                logger.debug("LLM Router queue processing cancelled")
                raise
            except (QueueError, ValueError) as e:
                logger.error("Error processing queue", metadata={
                    "error": str(e),
                    "error_type": type(e).__name__
                })
                await asyncio.sleep(1)
        
    async def route_email(self, email: EmailMessage) -> None:
        """Route email to appropriate handler based on system.
        
        Args:
            email: The email message to route
        """
        try:
            logger.debug("Routing email", metadata={
                "system": email.system,
                "uid": email.uid,
                "from": email.from_addr
            })
            
            if email.system == "pace_notes":
                await self.pace_note.process(email)
            else:
                logger.warn("Unknown system for email", metadata={
                    "system": email.system,
                    "uid": email.uid
                })
                
        except (ValueError, RuntimeError) as e:
            logger.error("Error routing email", metadata={
                "system": email.system,
                "uid": email.uid,
                "error": str(e),
                "error_type": type(e).__name__
            })
