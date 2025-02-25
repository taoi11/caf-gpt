"""Main application entry point and orchestration of email processing and LLM routing services.
Handles:
- Application lifecycle management
- Email queue processing
- LLM request routing
- Graceful shutdown handling
- System health monitoring
"""

import asyncio
import signal as signal_module  # Renamed to avoid conflict
from typing import Optional
from src.utils.logger import logger
from src.emails.queue_add import QueueManager
from src.llm import LLMRouter


class Application:
    """Main application class for managing lifecycle."""
    
    def __init__(self):
        self.queue_manager: Optional[QueueManager] = None
        self.llm_router: Optional[LLMRouter] = None
        self.running = False
        self._shutdown_event = asyncio.Event()
        self._shutting_down = False  # Flag to prevent multiple shutdown attempts
    
    async def start(self) -> None:
        """Start all application components."""
        self.running = True
        
        # Start queue manager and log initial health
        logger.info("Starting queue manager")
        self.queue_manager = QueueManager()
        await self.queue_manager.start()

        health = self.queue_manager.get_health_check()
        logger.info("Queue manager started and healthy", metadata={
            "connection": health["connection"],
            "queue_stats": health["queue"],
            "status": "initialized"
        })
        
        # Start LLM router
        logger.info("Starting LLM router")
        self.llm_router = LLMRouter()
        self.llm_router.start_watching(self.queue_manager.queue)
        
        # Keep the application running with health checks
        while not self._shutdown_event.is_set():
            if self.queue_manager:
                health = self.queue_manager.get_health_check()
                if health["connection"]["errors"] > 10:
                    logger.error("Too many connection errors, shutting down")
                    await self.stop()
                    break
            
            # Use a shorter timeout and check shutdown event more frequently
            try:
                await asyncio.wait_for(self._shutdown_event.wait(), 5)
            except asyncio.TimeoutError:
                pass  # Continue with next health check
    
    async def stop(self) -> None:
        """Stop the application gracefully with timeout protection."""
        if self._shutting_down:
            return  # Prevent multiple shutdown attempts
            
        self._shutting_down = True
        self.running = False
        logger.info("Shutting down application...")
        
        shutdown_tasks = []
        
        # First stop LLM router with timeout
        if self.llm_router:
            llm_shutdown = asyncio.create_task(self._stop_with_timeout(
                self.llm_router.stop(), "LLM Router", 3))
            shutdown_tasks.append(llm_shutdown)
        
        # Then stop queue manager with timeout
        if self.queue_manager:
            queue_shutdown = asyncio.create_task(self._stop_with_timeout(
                self.queue_manager.stop(), "Queue Manager", 3))
            shutdown_tasks.append(queue_shutdown)
        
        # Wait for all shutdown tasks to complete
        if shutdown_tasks:
            await asyncio.gather(*shutdown_tasks, return_exceptions=True)
            
        self._shutdown_event.set()
        logger.info("Application shutdown complete")
    
    async def _stop_with_timeout(self, coro, component_name, timeout=3):
        """Execute a coroutine with a timeout."""
        try:
            await asyncio.wait_for(coro, timeout)
            logger.debug(f"{component_name} shutdown completed within timeout")
        except asyncio.TimeoutError:
            logger.warning(f"{component_name} shutdown timed out after {timeout}s")

    def _handle_signals(self) -> None:
        """Set up signal handlers for graceful shutdown."""
        for sig in (signal_module.SIGINT, signal_module.SIGTERM):
            asyncio.get_event_loop().add_signal_handler(
                sig, lambda: asyncio.create_task(self._handle_signal()))
    
    async def _handle_signal(self) -> None:
        """Handle shutdown signal and ensure application stops."""
        logger.info("Received shutdown signal")
        await self.stop()
        # Force exit if shutdown takes too long
        asyncio.get_event_loop().call_later(5, self._force_exit)
    
    def _force_exit(self) -> None:
        """Force exit if shutdown takes too long."""
        if self.running or self._shutting_down:
            logger.warning("Forcing application exit after timeout")
            import sys
            sys.exit(1)

    def setup_signal_handlers(self) -> None:
        """Set up signal handlers for graceful shutdown."""
        self._handle_signals()


async def main() -> None:
    """Application entry point."""
    app = Application()
    app.setup_signal_handlers()
    await app.start()


if __name__ == "__main__":
    asyncio.run(main())
