import os
import sys
from pathlib import Path
import asyncio

# Add src to Python path
src_path = Path(__file__).parent.parent
sys.path.append(str(src_path))

from src.utils.logger import logger
from src.emails.processor import EmailProcessor
from src.llm import LLMRouter

async def main():
    """Main application entry point."""
    email_processor = None
    try:
        # Start email processor (no LLM dependency)
        logger.info("Starting email processor")
        email_processor = EmailProcessor()
        await email_processor.start()

        # Log initial health status
        health = email_processor.get_health_check()
        logger.info("Email processor health", metadata={
            "connection": health["connection"],
            "queue_stats": health["queue"]
        })

        # Start LLM router to watch queue
        logger.info("Starting LLM router")
        llm_router = LLMRouter()
        llm_router.start_watching(email_processor.queue)

        # Keep the application running with health checks
        while True:
            health = email_processor.get_health_check()
            logger.debug("System health", metadata={
                "queue_stats": health["queue"],
                "connection": health["connection"]
            })
            await asyncio.sleep(60)  # Health check every minute

    except KeyboardInterrupt:
        logger.info("Received shutdown signal")
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
    finally:
        if email_processor:
            await email_processor.stop()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass  # Exit cleanly on Ctrl+C
