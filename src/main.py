import os
import sys
from pathlib import Path
import asyncio

# Add src to Python path
src_path = Path(__file__).parent.parent
sys.path.append(str(src_path))

from src.utils.logger import logger
from src.emails.processor import EmailProcessor

async def main():
    """Main application entry point."""
    try:
        # Start email processor
        logger.info("Starting email processor")
        await email_processor.start()

        # Keep the application running
        while True:
            await asyncio.sleep(1)

    except KeyboardInterrupt:
        logger.info("Received shutdown signal")
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
    finally:
        # Always ensure clean shutdown
        await email_processor.stop()

if __name__ == "__main__":
    email_processor = EmailProcessor()
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass  # Exit cleanly on Ctrl+C
