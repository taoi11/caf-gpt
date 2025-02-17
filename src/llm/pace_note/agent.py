"""Pace Notes agent for processing performance feedback requests."""

from pathlib import Path

from src.utils.logger import logger
from src.utils.config import MODELS

class PaceNoteAgent:
    """Agent responsible for processing pace notes using LLM capabilities.
    
    Handles the loading of prompts and interaction with the language model
    for processing performance feedback data.
    """
    def __init__(self):
        self.prompt_path = Path(__file__).parent.parent.parent / "prompts" / "paceNote" / "paceNote.md"
        self.system_prompt = ""
        
        # Initialize prompt
        self._initialize_prompt()

    def _initialize_prompt(self) -> None:
        """Initialize by loading the prompt file (read-only)"""
        try:
            logger.debug('Loading system prompt', {'path': str(self.prompt_path)})
            self.system_prompt = self.prompt_path.read_text()
            
            # For now, leave competency_list as placeholder
            self.system_prompt = self.system_prompt.replace(
                '{competency_list}', 
                '(competency list placeholder)'
            ).replace(
                '{examples}',
                'Example 1: ...\nExample 2: ...'  # Add actual examples later
            )

            logger.info('System prompt loaded successfully')
            
        except Exception as error:
            logger.error('Failed to initialize prompt', {
                'error': str(error)
            })
            raise ValueError('Failed to load prompt file') from error

    def process(self, email_content: str) -> None:
        """Process email content and log would-be LLM request"""
        try:
            # Format the would-be LLM request
            request = {
                "model": MODELS['paceNote'],
                "messages": [
                    {
                        "role": "system",
                        "content": self.system_prompt
                    },
                    {
                        "role": "user",
                        "content": email_content
                    }
                ],
                "temperature": 0.1
            }
            
            # Log full request details
            logger.debug("Would send LLM request", {
                "model": request["model"],
                "system_prompt_preview": request["messages"][0]["content"][:200],
                "user_message_preview": request["messages"][1]["content"][:200],
                "full_request": request  # Log entire request for debugging
            })
            
        except Exception as error:
            logger.error('Error preparing LLM request', {
                'error': str(error)
            })
            raise

# Export singleton instance
pace_note_agent = PaceNoteAgent()
