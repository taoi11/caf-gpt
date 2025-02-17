"""Pace Notes processing module for performance feedback."""

# Package initialization

from src.utils.logger import logger
from src.types import EmailMessage
from src.utils.config import MODELS
from src.llm.pace_note.agent import pace_note_agent

class PaceNoteHandler:
    """Handles the processing of pace notes through LLM interactions."""
    def __init__(self):
        self.agent = pace_note_agent
        
    def process(self, email: EmailMessage):
        """Process a pace note email through the LLM agent.
        
        Args:
            email: The email message containing pace note data to process
        """
        # Format email exactly as it would be sent to LLM
        email_content = f'''
From: {email.metadata.get('from')}
Subject: {email.metadata.get('subject')}

{email.raw_content}
'''
        
        try:
            # Log the exact content that would be sent to LLM
            logger.debug("=== Email Content for LLM Processing ===")
            logger.debug(f"Email UID: {email.get_uid()}")
            logger.debug(f"System: {email.get_system()}")
            logger.debug("Content that would be sent to LLM:")
            logger.debug("-" * 50)
            logger.debug(email_content)
            logger.debug("-" * 50)
            logger.debug(f"Total content length: {len(email_content)} characters")
            
        except Exception as error:
            logger.error('Pace Note processing error', {
                'error': str(error)
            })
            raise 
