import os
from pathlib import Path
from typing import Dict, Optional

import boto3
from botocore.client import BaseClient

from ...utils.logger import logger
from ...utils.llm_gateway import llm_gateway, Message
from ...utils.config import MODELS

class PaceNoteAgent:
    def __init__(self):
        self.prompt_path = Path(__file__).parent.parent.parent / "prompts" / "paceNote" / "paceNote.md"
        self.examples_path = Path(__file__).parent.parent.parent / "prompts" / "paceNote" / "examples.md"
        self.system_prompt = ""
        self.examples = ""
        self.s3_client: Optional[BaseClient] = None

        # Initialize prompts
        self._initialize_prompts()

    def _initialize_prompts(self) -> None:
        """Initialize by loading the prompt files (read-only)"""
        try:
            logger.debug('Loading system prompt', {'path': str(self.prompt_path)})
            logger.debug('Loading examples', {'path': str(self.examples_path)})

            # Read both files
            self.system_prompt = self.prompt_path.read_text()
            self.examples = self.examples_path.read_text()

            logger.log_llm_interaction({
                'role': 'system',
                'content': self.system_prompt,
                'metadata': {
                    'timestamp': None  # Logger will add timestamp
                }
            })

            logger.info('System prompt and examples loaded successfully')
        except Exception as error:
            logger.error('Failed to initialize prompts', {
                'error': str(error)
            })
            raise ValueError('Failed to load prompt files')

    async def _read_competencies(self, path: str = 'paceNote/cpl_mcpl.md') -> str:
        """Read competencies from S3 (read-only)"""
        try:
            logger.debug('Reading competencies', {'path': path, 'source': 'S3'})
            
            if not self.s3_client:
                self.s3_client = boto3.client(
                    's3',
                    aws_access_key_id=os.getenv('S3_ACCESS_KEY'),
                    aws_secret_access_key=os.getenv('S3_SECRET_KEY')
                )

            response = self.s3_client.get_object(
                Bucket=os.getenv('S3_BUCKET_NAME'),
                Key=path
            )

            competencies = response['Body'].read().decode('utf-8')
            if not competencies:
                logger.error('Empty competencies list received from S3')
                raise ValueError('Empty competencies list')

            logger.debug('Competencies loaded successfully')
            return competencies

        except Exception as error:
            logger.error('Failed to read competencies', {
                'path': path,
                'error': str(error)
            })
            raise ValueError('Failed to read competencies list')

    async def generate_note(self, request: Dict) -> Dict:
        """Generate pace note"""
        # Ensure prompts are loaded
        if not self.system_prompt or not self.examples:
            logger.info('Prompts not loaded, loading now...')
            self._initialize_prompts()

        # Read competencies
        competencies = await self._read_competencies()

        # Fill the prompt template
        logger.debug('Preparing prompt with competencies and examples')
        filled_prompt = self.system_prompt\
            .replace('{competency_list}', competencies)\
            .replace('{examples}', self.examples)

        # Create message
        user_message: Message = {
            'role': 'user',
            'content': request['input']
        }

        logger.debug('Sending request to LLM')
        response = await llm_gateway.query({
            'messages': [user_message],
            'systemPrompt': filled_prompt,
            'model': MODELS['paceNote'],
            'temperature': 0.7
        })

        logger.log_llm_interaction({
            'role': 'assistant',
            'content': response['content'],
            'metadata': {
                'model': MODELS['paceNote'],
                'usage': response['usage']
            }
        })

        logger.debug('LLM response received, preparing response')
        return {
            'content': response['content'],
            'timestamp': None,  # FastAPI will serialize this
            'rank': request.get('rank')
        }

# Export singleton instance
pace_note_agent = PaceNoteAgent() 