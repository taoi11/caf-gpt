# Empty file for package recognition 

from src.utils.logger import logger
from src.types import EmailMessage
from src.utils.config import MODELS
from src.llm.pace_note.agent import pace_note_agent

class PaceNoteHandler:
    def __init__(self):
        self.agent = pace_note_agent
        
    def process(self, email: EmailMessage):
        # Format email for LLM
        email_content = f'''
From: {email.metadata.get('from')}
Subject: {email.metadata.get('subject')}

{email.raw_content}
'''
        
        try:
            logger.debug("PaceNote handler formatting email", {
                "from": email.metadata.get('from'),
                "subject": email.metadata.get('subject'),
                "content_preview": email_content[:100],  # Show formatted content
                "content_length": len(email.raw_content)
            })
            
            # Use the agent to process
            self.agent.process(email_content)
            
        except Exception as error:
            logger.error('Pace Note processing error', {
                'error': str(error)
            })
            raise 