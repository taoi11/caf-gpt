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
        email_processor = EmailProcessor()  # No router needed
        await email_processor.start()

        # Start LLM router to watch queue
        logger.info("Starting LLM router")
        llm_router = LLMRouter()
        llm_router.start_watching(email_processor.queue)  # Pass queue reference

        # Keep the application running
        while True:
            await asyncio.sleep(1)

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
