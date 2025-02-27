"""Email processing orchestration and management.
Coordinates the email retrieval, parsing, and queueing process with:
- Email connection management
- Processing loop orchestration
- Health monitoring and reporting
- Graceful shutdown handling
"""

import asyncio
from datetime import datetime
from typing import Optional

from src.utils.logger import logger
from src.emails.parser import EmailParser
from src.emails.connection import IMAPConnection
from src.emails.queue import EmailQueue
from src.types import EmailHealthCheck


class ProcessingError(Exception):
    """Custom exception for email processing errors."""
    def __init__(self, message: str):
        super().__init__(message)


class QueueManager:
    """Manages email retrieval, parsing and queueing workflow."""

    def __init__(self):
        """Initialize the queue manager."""
        self.connection = IMAPConnection()
        self.parser = EmailParser()
        self.queue = EmailQueue()
        self._running = False
        self._processing_task: Optional[asyncio.Task] = None
        self._shutdown_event = asyncio.Event()
        
        # Group health monitoring metrics in a single dictionary
        self._health_metrics = {
            'last_check': datetime.now(),
            'message_count': 0,
            'error_count': 0
        }

    async def start(self) -> None:
        """Start the email processing loop."""
        if self._running:
            logger.warn("Queue manager already running")
            return
            
        # Connect to IMAP server
        if not await self.connection.connect():
            raise ProcessingError("Failed to connect to IMAP server")
            
        # Start processing loop
        self._running = True
        self._shutdown_event.clear()
        self._processing_task = asyncio.create_task(self._processing_loop())
        logger.info("Queue manager started")

    async def stop(self) -> None:
        """Stop the email processing loop gracefully."""
        if not self._running:
            logger.debug("Queue manager already stopped")
            return
            
        logger.info("Stopping queue manager")
        self._running = False
        self._shutdown_event.set()
        
        # Wait for processing loop to finish with timeout
        if self._processing_task:
            try:
                await asyncio.wait_for(self._processing_task, timeout=5.0)
                logger.debug("Processing loop stopped gracefully")
            except asyncio.TimeoutError:
                logger.warning("Processing loop did not stop gracefully, cancelling")
                self._processing_task.cancel()
                
        # Close IMAP connection
        await self.connection.close()
        logger.info("Queue manager stopped")

    async def _processing_loop(self) -> None:
        """Main processing loop for email retrieval and queueing."""
        while self._running and not self._shutdown_event.is_set():
            try:
                # Check connection health
                if not self.connection.is_connected():
                    if not await self.connection.connect():
                        logger.error("Failed to reconnect to IMAP server")
                        await asyncio.sleep(5)  # Wait before retry
                        continue
                
                # Fetch new messages
                messages = await self.connection.get_unread_messages()
                
                if messages:
                    logger.info(f"Retrieved {len(messages)} new messages")
                    self._health_metrics['message_count'] += len(messages)
                    
                    # Add messages to queue
                    added = await self.queue.add_emails(messages)
                    logger.debug(f"Added {added} messages to queue")
                    
                    # Don't mark messages as read here - let the LLM module do it after processing
                
                # Sleep before next fetch
                try:
                    # Use wait_for with the shutdown event for interruptible sleep
                    await asyncio.wait_for(
                        self._shutdown_event.wait(), 
                        timeout=10
                    )
                except asyncio.TimeoutError:
                    # Timeout means we can continue the loop
                    pass
                    
            except (ConnectionError, OSError, asyncio.CancelledError, RuntimeError) as e:
                self._health_metrics['error_count'] += 1
                logger.exception(f"Error in processing loop: {str(e)}")
                
                # Wait a bit before retrying
                await asyncio.sleep(5)

    def get_health_check(self) -> EmailHealthCheck:
        """Get health status of the email processing system.
        
        Returns:
            EmailHealthCheck: Health check information
        """
        now = datetime.now()
        uptime = (now - self._health_metrics['last_check']).total_seconds()
        self._health_metrics['last_check'] = now
        
        queue_stats = self.queue.get_stats()
        connection_health = self.connection.get_health_check()
        
        # Calculate messages per minute
        messages_per_minute = 0
        if uptime > 0:
            messages_per_minute = int((self._health_metrics['message_count'] / uptime) * 60)
            self._health_metrics['message_count'] = 0  # Reset counter
        
        return {
            "running": self._running,
            "queue": queue_stats,
            "connection": connection_health,
            "metrics": {
                "uptime": uptime,
                "messages_per_minute": messages_per_minute,
                "error_count": self._health_metrics['error_count'],
            }
        } 