"""LLM Gateway module for handling model interactions through Ollama.
Provides both streaming and non-streaming interfaces for language model queries,
with built-in error handling, message formatting, and response processing."""

import os
from typing import List, Optional

from ollama import Client, ResponseError

from src.types import Message, LLMResponse, LLMErrorDetails
from src.utils.logger import logger

# Configuration - now using Ollama
OLLAMA_HOST = os.getenv('OLLAMA_HOST', 'http://localhost:11434')
DEFAULT_TEMPERATURE = 0.1


class LLMError(Exception):
    """Custom exception for LLM-related errors with detailed information."""
    def __init__(self, details: LLMErrorDetails):
        self.details = details


class LLMGateway:
    """Gateway for interacting with Language Models through Ollama.
    
    Handles message formatting, error handling, and response processing
    for both streaming and non-streaming LLM interactions.
    """
    def __init__(self):
        """Initialize the LLM gateway with Ollama client."""
        self.client = Client(
            host=OLLAMA_HOST,
            timeout=60  # Increased timeout for local models
        )

    def query(self, messages: List[Message], model: str, temperature: Optional[float] = None, stream: bool = False) -> LLMResponse:
        """Send a query to the language model and process its response.
        
        Args:
            messages: List of conversation messages to send
            model: Name of the model to use
            temperature: Optional temperature parameter for response randomness
            stream: Whether to use streaming response mode
            
        Returns:
            LLMResponse containing the model's response and usage statistics
            
        Raises:
            LLMError: If the model request fails or returns an error
        """
        try:
            final_temperature = temperature if temperature is not None else DEFAULT_TEMPERATURE

            # Convert message format for Ollama
            ollama_messages = [{'role': msg.role, 'content': msg.content} for msg in messages]

            # Make the API call using sync client
            response = self.client.chat(
                model=model,
                messages=ollama_messages,
                options={'temperature': final_temperature},
                stream=stream  # Add stream parameter
            )

            # Handle streaming response differently if needed
            if stream:
                # For streaming, we'll concatenate all chunks
                full_response = ""
                for chunk in response:
                    full_response += chunk['message']['content']

                # Format response with concatenated content
                llm_response: LLMResponse = {
                    'content': full_response,
                    'model': model,
                    'usage': {
                        'prompt_tokens': 0,
                        'completion_tokens': 0,
                        'total_tokens': 0
                    }
                }
            else:
                # Normal response handling
                llm_response: LLMResponse = {
                    'content': response.message['content'],
                    'model': response.model,
                    'usage': {
                        'prompt_tokens': 0,
                        'completion_tokens': 0,
                        'total_tokens': 0
                    }
                }

            # Log response
            logger.log_llm_interaction({
                'role': 'assistant',
                'content': llm_response['content'],
                'metadata': {
                    'model': llm_response['model'],
                    'usage': llm_response['usage']
                }
            })

            return llm_response

        except ResponseError as error:
            logger.error('LLM request failed', {
                'error': str(error),
                'model': model,
                'messageCount': len(messages),
                'temperature': final_temperature
            })
            raise LLMError(LLMErrorDetails(
                code=error.status_code,
                message=error.error,
                error_type='ollama_error'
            )) from error

        except Exception as error:
            logger.error('Unexpected LLM error', {
                'error': str(error),
                'model': model,
                'messageCount': len(messages)
            })
            raise LLMError(LLMErrorDetails(
                code=500,
                message=str(error),
                error_type='unknown_error'
            )) from error


# Export singleton instance
llm_gateway = LLMGateway()
