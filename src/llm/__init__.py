# Empty file for package recognition 

import asyncio
from src.utils.logger import logger
from src.types import EmailMessage
from src.llm.pace_note import PaceNoteHandler
from src.emails.queue import EmailQueue

class LLMRouter:
    def __init__(self):
        self.pace_note = PaceNoteHandler()
        self.queue = None
        self.running = False
        
    def start_watching(self, queue: EmailQueue):
        """Start watching the email queue for messages to process"""
        self.queue = queue
        self.running = True
        
        # Start processing loop
        asyncio.create_task(self._process_queue())
        logger.info("LLM Router now watching email queue")
        
    async def _process_queue(self):
        """Continuously process emails from queue"""
        while self.running:
            try:
                # Check queue for emails
                if not self.queue.is_empty():
                    logger.debug("Queue not empty, getting next email")
                    email = self.queue.get_next_email()
                    if email:
                        logger.debug("Got email from queue", {
                            "system": email.get_system(),
                            "uid": email.get_uid()
                        })
                        self.route_email(email)
                    else:
                        logger.debug("Got None from queue")
                else:
                    logger.debug("Queue is empty")
                
                # Wait before next check
                await asyncio.sleep(1)
                
            except Exception as e:
                logger.error(f"Error processing queue: {str(e)}")
                await asyncio.sleep(1)
        
    def route_email(self, email: EmailMessage):
        logger.debug("LLM Router received email", {
            "system": email.get_system(),
            "uid": email.get_uid(),
            "metadata": email.metadata,
            "content_preview": email.raw_content[:100]
        })
        
        if email.get_system() == "pace_notes":
            logger.debug("Routing to PaceNote handler")
            return self.pace_note.process(email)