"""LLM routing and processing module."""

import asyncio
from typing import Optional, Union, TYPE_CHECKING

from src.utils.logger import logger
from src.types import EmailMessage
from src.llm.pace_note import PaceNoteHandler
from src.emails.queue import EmailQueue, QueueError

# Import IMAPConnection at the module level to avoid import-outside-toplevel
if TYPE_CHECKING:
    # This avoids circular imports
    from src.emails.connection import IMAPConnection


class LLMRouter:
    """Routes emails to appropriate LLM handlers based on system type."""
    
    def __init__(self):
        self.pace_note = PaceNoteHandler()
        self.queue: Optional[EmailQueue] = None
        self.running = False
        self._process_task: Optional[asyncio.Task] = None
        self._active_handlers = {
            "pace_notes": self.pace_note
        }
        
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
                # Cancel the task and wait for it to complete with a timeout
                self._process_task.cancel()
                try:
                    # Wait for cancellation to complete with a timeout
                    await asyncio.wait_for(asyncio.shield(self._process_task), timeout=2.0)
                except asyncio.TimeoutError:
                    logger.warning("Timed out waiting for LLM Router task to cancel")
                except asyncio.CancelledError:
                    logger.debug("LLM Router task cancellation handled")
            except (RuntimeError, ValueError, KeyError) as e:
                logger.error(f"Error during LLM Router shutdown: {e}")
            self._process_task = None
        
        logger.info("LLM Router shutdown complete")
        
    async def _process_queue(self) -> None:
        """Continuously process emails from queue."""
        while self.running:
            try:
                if not self.queue or await self.queue.empty():
                    # Check more frequently to allow for faster shutdown
                    await asyncio.sleep(0.5)
                    continue

                # Get next email from queue
                email = await self.queue.get()
                if email:
                    logger.debug("Processing email from queue", metadata={
                        "system": email.get_system(),
                        "uid": email.get_uid(),
                        "from": email.from_addr
                    })
                    await self.route_email(email)
                
                # Wait before next check - shorter interval for responsiveness
                await asyncio.sleep(0.5)
                
            except asyncio.CancelledError:
                logger.debug("LLM Router queue processing cancelled")
                raise
            except (QueueError, ValueError) as e:
                logger.error("Error processing queue", metadata={
                    "error": str(e),
                    "error_type": type(e).__name__
                })
                await asyncio.sleep(0.5)  # Reduced from 1 second
        
    async def _forward_email(self, email: EmailMessage) -> None:
        """Forward an email to the appropriate handler."""
        logger.info("Forwarding email to handler", metadata={
            "handler": self._active_handlers.get(email.get_system()),
            "system": email.get_system(),
            "subject": email.subject,
            "from": email.from_addr
        })
        
        # Call the handler for the system
        await self._active_handlers[email.get_system()].process(email)

    async def route_email(self, email: EmailMessage) -> None:
        """Route email to appropriate handler based on system.
        
        This is the main entry point for the LLM router.
        """
        try:
            logger.info("Routing email to appropriate system", metadata={
                "system": email.get_system(),
                "subject": email.subject,
                "from": email.from_addr
            })
            
            if email.get_system() == "pace_notes":
                await self._forward_email(email)
            else:
                logger.warn("Unknown system for email", metadata={
                    "system": email.get_system(),
                    "subject": email.subject
                })
                
                # Log warning for unknown system
                logger.error("No handler available for system", metadata={
                    "system": email.get_system(),
                    "available_handlers": list(self._active_handlers.keys())
                })
                
            # Now mark the email as read only after processing is complete
            await self._mark_as_read(email)
            
            # Mark task as done in the queue to allow for proper tracking
            if self.queue:
                self.queue.task_done(email)
                logger.debug("Marked email as completed in queue", metadata={
                    "uid": email.get_uid(),
                    "system": email.get_system()
                })
                
        except (ValueError, KeyError, AttributeError, ImportError, ModuleNotFoundError, ConnectionError) as e:
            logger.error("Error processing email", metadata={
                "error": str(e),
                "error_type": type(e).__name__,
                "email_uid": email.get_uid(),
                "system": email.get_system()
            })
            
    async def _mark_as_read(self, email: EmailMessage) -> None:
        """Mark an email as read after it has been processed.
        
        Args:
            email: The email message to mark as read
        """
        # pylint: disable=import-outside-toplevel
        # Must import here to avoid circular dependency with connection.py
        import src.emails.connection as connection_module
        
        try:
            # Create a connection to mark as read
            connection = connection_module.IMAPConnection()
            await connection.connect()
            
            system = email.get_system()
            uid = email.get_uid()
            
            # Find the right mailbox for this system
            if system in connection.config.mailboxes:
                mailbox = connection.config.mailboxes[system]
                if await connection.mark_as_read(uid, mailbox):
                    logger.info("Marked email as read after processing", metadata={
                        "uid": uid,
                        "system": system,
                        "mailbox": mailbox
                    })
                else:
                    logger.error("Failed to mark email as read", metadata={
                        "uid": uid,
                        "system": system,
                        "mailbox": mailbox
                    })
            else:
                logger.error("No mailbox configured for system", metadata={
                    "system": system,
                    "available_mailboxes": list(connection.config.mailboxes.keys())
                })
                
            # Close connection when done
            await connection.close()
        except (ConnectionError, OSError, asyncio.TimeoutError, ValueError) as e:
            logger.error("Error marking email as read", metadata={
                "error": str(e),
                "error_type": type(e).__name__,
                "email_uid": email.get_uid()
            })
