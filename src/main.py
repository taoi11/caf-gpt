"""Main application entry point and orchestration."""

import asyncio
import signal
from typing import Optional

from src.utils.logger import logger
from src.emails.processor import EmailProcessor
from src.llm import LLMRouter


class Application:
    """Main application class for managing lifecycle."""
    
    def __init__(self):
        self.email_processor: Optional[EmailProcessor] = None
        self.llm_router: Optional[LLMRouter] = None
        self.running = False
        self._shutdown_event = asyncio.Event()
    
    async def start(self) -> None:
        """Start all application components."""
        self.running = True
        
        # Start email processor
        logger.info("Starting email processor")
        self.email_processor = EmailProcessor()
        await self.email_processor.start()
        
        # Log initial health status
        health = self.email_processor.get_health_check()
        logger.info("Email processor health", metadata={
            "connection": health["connection"],
            "queue_stats": health["queue"]
        })
        
        # Start LLM router
        logger.info("Starting LLM router")
        self.llm_router = LLMRouter()
        self.llm_router.start_watching(self.email_processor.queue)
        
        # Keep the application running with health checks
        while not self._shutdown_event.is_set():
            if self.email_processor:
                health = self.email_processor.get_health_check()
                logger.debug("System health", metadata={
                    "queue_stats": health["queue"],
                    "connection": health["connection"]
                })
            await asyncio.sleep(60)  # Health check every minute
    
    async def stop(self) -> None:
        """Stop all application components gracefully."""
        logger.info("Starting graceful shutdown...")
        self.running = False
        self._shutdown_event.set()
        
        # Stop LLM router first
        if self.llm_router:
            await self.llm_router.stop()
        
        # Then stop email processor
        if self.email_processor:
            await self.email_processor.stop()
        
        logger.info("Application shutdown complete")


def handle_signals() -> None:
    """Setup signal handlers for graceful shutdown."""
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, lambda s=sig: asyncio.create_task(_shutdown(loop, sig)))


async def _shutdown(loop: asyncio.AbstractEventLoop, signal: int) -> None:
    """Handle shutdown signal."""
    logger.info(f"Received exit signal {signal.name}")
    
    tasks = [t for t in asyncio.all_tasks() if t is not asyncio.current_task()]
    
    # Give tasks chance to complete
    [task.cancel() for task in tasks]
    
    logger.info(f"Cancelling {len(tasks)} outstanding tasks")
    await asyncio.gather(*tasks, return_exceptions=True)
    loop.stop()


async def main() -> None:
    """Main application entry point."""
    app = Application()
    
    try:
        handle_signals()
        await app.start()
    except asyncio.CancelledError:
        pass
    finally:
        await app.stop()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass  # Exit cleanly on Ctrl+C
