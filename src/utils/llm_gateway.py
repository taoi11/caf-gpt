import os
from typing import Dict, List, Optional, TypedDict
from uuid import uuid4
import httpx

from .logger import logger
# from .cost_tracker import cost_tracker

# Connection pool configuration
MAX_CONCURRENT_REQUESTS = 50
DEFAULT_MAX_CONTEXT = 10
DEFAULT_TEMPERATURE = 0.1

# OpenRouter configuration
OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
OPENROUTER_API_KEY = os.getenv('LLM_API_KEY', '')
LLM_MODEL = os.getenv('PACE_NOTE_MODEL', '')

class Message(TypedDict):
    role: str
    content: str

class LLMRequest(TypedDict):
    model: Optional[str]
    messages: List[Message]
    temperature: Optional[float]
    systemPrompt: Optional[str]
    maxContextLength: Optional[int]

class LLMResponse(TypedDict):
    content: str
    model: str
    usage: Dict[str, int]

class LLMError(Exception):
    def __init__(self, message: str, code: str, error_type: str):
        self.message = message
        self.code = code
        self.type = error_type

class LLMGateway:
    def __init__(self):
        self.active_requests = 0
        self.client = httpx.AsyncClient()

    async def query(self, request: LLMRequest) -> LLMResponse:
        try:
            # Wait if too many active requests
            if self.active_requests >= MAX_CONCURRENT_REQUESTS:
                raise ValueError('Too many concurrent requests')
            self.active_requests += 1

            # Generate request ID
            request_id = str(uuid4())

            # Prepare messages with system prompt if provided
            messages = self._prepare_messages(request)

            # Prepare complete request body
            request_body = {
                'model': request.get('model', LLM_MODEL),
                'messages': messages,
                'temperature': request.get('temperature', DEFAULT_TEMPERATURE)
            }

            # Log request
            await logger.log_llm_interaction({
                'role': 'system',
                'content': request.get('systemPrompt', ''),
                'metadata': {
                    'requestId': request_id,
                    'type': 'request',
                    'model': request_body['model'],
                    'temperature': request_body['temperature'],
                    'messages': request_body['messages'],
                    'timestamp': None  # Logger will add timestamp
                }
            })

            async with self.client as client:
                response = await client.post(
                    OPENROUTER_API_URL,
                    headers={
                        'Content-Type': 'application/json',
                        'Authorization': f'Bearer {OPENROUTER_API_KEY}'
                    },
                    json=request_body
                )

                if not response.is_success:
                    error = response.json()
                    raise self._handle_error(error)

                result = response.json()
                llm_response: LLMResponse = {
                    'content': result['choices'][0]['message']['content'],
                    'model': result['model'],
                    'usage': result['usage']
                }

                # Track costs
                if result['usage']:
                    # await cost_tracker.track_usage(result['usage'])
                    pass

                # Log response
                await logger.log_llm_interaction({
                    'role': 'assistant',
                    'content': llm_response['content'],
                    'metadata': {
                        'requestId': request_id,
                        'type': 'response',
                        'model': llm_response['model'],
                        'usage': llm_response['usage'],
                        'timestamp': None,  # Logger will add timestamp
                        'rawResponse': result
                    }
                })

                return llm_response

        except ValueError as error:
            logger.error('LLM request failed', {
                'error': str(error),
                'model': request.get('model', LLM_MODEL),
                'messageCount': len(request.get('messages', [])),
                'temperature': request.get('temperature', DEFAULT_TEMPERATURE)
            })
            raise
        finally:
            self.active_requests -= 1

    def _prepare_messages(self, request: LLMRequest) -> List[Message]:
        messages = request.get('messages', [])

        # Apply context length limit if specified
        max_context = request.get('maxContextLength', DEFAULT_MAX_CONTEXT)
        if len(messages) > max_context:
            messages = messages[-max_context:]
            logger.debug('Trimmed conversation history', {
                'originalLength': len(request['messages']),
                'trimmedLength': len(messages),
                'maxContext': max_context
            })

        # Add system prompt if provided
        if request.get('systemPrompt'):
            system_message: Message = {
                'role': 'system',
                'content': request['systemPrompt']
            }
            return [system_message, *messages]

        return messages

    def _handle_error(self, error: Dict) -> LLMError:
        return LLMError(
            code=error.get('error', {}).get('code', 'unknown'),
            message=error.get('error', {}).get('message', 'Unknown error occurred'),
            error_type=error.get('error', {}).get('type', 'api_error')
        )

# Export singleton instance
llm_gateway = LLMGateway()
