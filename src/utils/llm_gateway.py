from ollama import Client, ResponseError
import os
from ..types import Message, LLMResponse, LLMErrorDetails
from .logger import logger

# Configuration - now using Ollama
OLLAMA_HOST = os.getenv('OLLAMA_HOST', 'http://localhost:11434')
DEFAULT_TEMPERATURE = 0.1

class LLMError(Exception):
    def __init__(self, details: LLMErrorDetails):
        self.details = details

class LLMGateway:
    def __init__(self):
        self.client = Client(
            host=OLLAMA_HOST,
            timeout=60  # Increased timeout for local models
        )

    def query(self, messages: List[Message], model: str, temperature: Optional[float] = None, stream: bool = False) -> LLMResponse:
        try:
            final_temperature = temperature if temperature is not None else DEFAULT_TEMPERATURE
            
            # Convert message format for Ollama
            ollama_messages = [{
                'role': msg.role,
                'content': msg.content
            } for msg in messages]

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

            # Log response (kept original logging format)
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
            ))
            
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
            ))

# Export singleton instance
llm_gateway = LLMGateway()
