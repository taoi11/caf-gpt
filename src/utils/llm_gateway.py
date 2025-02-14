from openai import OpenAI
import os
from ..types import Message, LLMResponse, LLMErrorDetails
from .logger import logger

# Configuration
OPENROUTER_API_KEY = os.getenv('LLM_API_KEY', '')
DEFAULT_TEMPERATURE = 0.1

class LLMError(Exception):
    def __init__(self, details: LLMErrorDetails):
        self.details = details

class LLMGateway:
    def __init__(self):
        self.client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=OPENROUTER_API_KEY
        )

    async def query(self, messages: List[Message], model: str, temperature: Optional[float] = None) -> LLMResponse:
        try:
            # Use DEFAULT_TEMPERATURE if temperature is not provided
            final_temperature = temperature if temperature is not None else DEFAULT_TEMPERATURE
            
            # Make the API call
            response = self.client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=final_temperature,
                extra_headers={
                    "X-Title": "caf-gpt"
                }
            )

            # Format response
            llm_response: LLMResponse = {
                'content': response.choices[0].message.content,
                'model': response.model,
                'usage': {
                    'prompt_tokens': response.usage.prompt_tokens,
                    'completion_tokens': response.usage.completion_tokens,
                    'total_tokens': response.usage.total_tokens
                }
            }

            # Log response
            await logger.log_llm_interaction({
                'role': 'assistant',
                'content': llm_response['content'],
                'metadata': {
                    'model': llm_response['model'],
                    'usage': llm_response['usage']
                }
            })

            return llm_response

        except Exception as error:
            error_data = getattr(error, 'response', {}).json() if hasattr(error, 'response') else {}
            logger.error('LLM request failed', {
                'error': str(error),
                'model': model,
                'messageCount': len(messages),
                'temperature': final_temperature
            })
            raise LLMError(LLMErrorDetails(
                code=error_data.get('error', {}).get('code', 'unknown'),
                message=error_data.get('error', {}).get('message', str(error)),
                error_type=error_data.get('error', {}).get('type', 'api_error')
            ))

# Export singleton instance
llm_gateway = LLMGateway()
