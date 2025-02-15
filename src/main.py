import os
import sys
import logging
from pathlib import Path
import asyncio

# Add src to Python path
src_path = Path(__file__).parent.parent
sys.path.append(str(src_path))

from src.emails.processor import EmailProcessor

# Configure logging
log_level = logging.DEBUG if os.getenv('DEVELOPMENT', 'false').lower() == 'true' else logging.INFO
logging.basicConfig(
    level=log_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize email processor
email_processor = EmailProcessor()

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
        logger.info("Shutting down...")
        await email_processor.stop()

if __name__ == "__main__":
    asyncio.run(main())
