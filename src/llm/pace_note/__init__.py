"""PaceNote email processing module."""

from typing import Optional, Dict, Union
from datetime import datetime

from src.utils.logger import logger
from src.types import EmailMessage
from src.llm.pace_note.agent import PaceNoteAgent


class PaceNoteHandler:
    """Handles processing of PaceNote system emails."""
    
    def __init__(self):
        """Initialize the handler with agent and metrics."""
        self.agent = PaceNoteAgent()
        self._start_time = datetime.now()
        self._processed_count = 0
        self._error_count = 0
        
    async def process(self, email: EmailMessage) -> None:
        """Process a PaceNote email message.
        
        Args:
            email: The email message to process
        """
        try:
            logger.info("Processing PaceNote email", metadata={
                "uid": email.uid,
                "from": email.from_addr,
                "subject": email.subject
            })
            
            # Process with agent
            response = await self.agent.handle_email(
                subject=email.subject,
                body=email.body,
                sender=email.from_addr
            )
            
            if response:
                self._processed_count += 1
                logger.info("Successfully processed PaceNote email", metadata={
                    "uid": email.uid,
                    "from": email.from_addr,
                    "response_length": len(response)
                })
            else:
                raise ValueError("Agent returned empty response")
                
        except (ValueError, RuntimeError, AttributeError) as e:
            self._error_count += 1
            logger.error("Error processing PaceNote email", metadata={
                "uid": email.uid,
                "from": email.from_addr,
                "error": str(e),
                "error_type": type(e).__name__
            })
            
    def get_stats(self) -> Dict[str, Union[int, float]]:
        """Get handler processing statistics.
        
        Returns:
            Dict containing processed count, error count, success rate and uptime
        """
        uptime = (datetime.now() - self._start_time).total_seconds()
        return {
            "processed_count": self._processed_count,
            "error_count": self._error_count,
            "success_rate": (
                (self._processed_count - self._error_count) / self._processed_count 
                if self._processed_count > 0 else 0
            ),
            "uptime_seconds": uptime
        } 
