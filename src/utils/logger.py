import json
import logging
import os
from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional
from uuid import uuid4
from .config import SERVER_CONFIG

# Define LogLevel enum first
class LogLevel(Enum):
    DEBUG = 0
    INFO = 1
    WARN = 2
    ERROR = 3

class Logger:
    def __init__(self, name: str = 'caf-gpt'):
        self.current_level = LogLevel.DEBUG if SERVER_CONFIG['development'] else LogLevel.INFO
        self.llm_requests: Dict[str, float] = {}  # Track request start times
        
        # Configure logging
        self._logger = logging.getLogger(name)
        self._logger.setLevel(logging.DEBUG if SERVER_CONFIG['development'] else logging.INFO)

        # Create console handler if none exists
        if not self._logger.handlers:
            ch = logging.StreamHandler()
            ch.setLevel(logging.DEBUG if SERVER_CONFIG['development'] else logging.INFO)

            # Create formatter
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            ch.setFormatter(formatter)
            self._logger.addHandler(ch)

    def debug(self, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        self._logger.debug(message, extra={'metadata': json.dumps(metadata) if metadata else 'no metadata'})

    def info(self, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        self._logger.info(message, extra={'metadata': json.dumps(metadata) if metadata else 'no metadata'})

    def warn(self, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        self._logger.warning(message, extra={'metadata': json.dumps(metadata) if metadata else 'no metadata'})

    def error(self, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        self._logger.error(message, extra={'metadata': json.dumps(metadata) if metadata else 'no metadata'})

    def _trim_system_message(self, content: str) -> str:
        max_length = 200
        if len(content) <= max_length * 2:
            return content
        return f"{content[:max_length]}...{content[-max_length:]}"

    def _format_llm_request(self, data: Dict[str, Any], request_id: str) -> str:
        # Trim system messages in the messages array
        messages = data.get('metadata', {}).get('messages', [])
        trimmed_messages = [
            {**msg, 'content': self._trim_system_message(msg['content'])} 
            if msg.get('role') == 'system' else msg
            for msg in messages
        ]

        # Create request object with trimmed content
        request = {
            'requestId': request_id,
            'timestamp': datetime.utcnow().isoformat(),
            'type': 'request',
            'model': data.get('metadata', {}).get('model'),
            'temperature': data.get('metadata', {}).get('temperature'),
            'messages': trimmed_messages
        }

        # Add additional metadata
        metadata = data.get('metadata', {})
        extra_metadata = {
            k: v for k, v in metadata.items() 
            if k not in ['model', 'temperature', 'messages', 'rawResponse']
        }
        
        return json.dumps({**request, **extra_metadata}, indent=2)

    def _format_llm_response(self, data: Dict[str, Any], request_id: str, duration_ms: int) -> str:
        response = {
            'requestId': request_id,
            'timestamp': datetime.utcnow().isoformat(),
            'type': 'response',
            'durationMs': duration_ms,
            'content': data.get('content'),
            'model': data.get('metadata', {}).get('model'),
            'usage': data.get('metadata', {}).get('usage')
        }

        # Add additional metadata
        metadata = data.get('metadata', {})
        extra_metadata = {
            k: v for k, v in metadata.items() 
            if k not in ['model', 'usage', 'rawResponse']
        }
        
        return json.dumps({**response, **extra_metadata}, indent=2)

    async def log_llm_interaction(self, data: Dict[str, Any]) -> None:
        if not SERVER_CONFIG['development']:
            return

        request_id = data.get('metadata', {}).get('requestId')
        is_request = data.get('metadata', {}).get('type') == 'request'

        if is_request:
            request_id = request_id or str(uuid4())
            self.llm_requests[request_id] = datetime.utcnow().timestamp()
            self._logger.debug("\n[LLM Request] %s\n%s", request_id, self._format_llm_request(data, request_id))
        else:
            start_time = self.llm_requests.get(request_id, 0) if request_id else 0
            duration_ms = int((datetime.utcnow().timestamp() - start_time) * 1000) if start_time else 0
            
            if request_id:
                self.llm_requests.pop(request_id, None)  # Cleanup
            
            self._logger.debug(
                "\n[LLM Response] %s\n%s", request_id or 'unknown',
                self._format_llm_response(data, request_id or 'unknown', duration_ms)
            )

    def log_request(self, method: str, url: str, status_code: int, metadata: Optional[Dict[str, Any]] = None) -> None:
        if not SERVER_CONFIG['development']:
            return
        
        path = url.split('?')[0]
        message = f"{method} {path} - {status_code}"
        
        if status_code >= 500:
            self.error(message, metadata)
        elif status_code >= 400:
            self.warn(message, metadata)
        elif status_code != 200:
            self.info(message, metadata)
        else:
            self.debug(message, metadata)

    def _should_log(self, level: LogLevel) -> bool:
        return SERVER_CONFIG['development'] or level.value >= self.current_level.value

# Export singleton instance
logger = Logger('email_processor')

# Helper functions for consistent logging
def log_error(message: str, **kwargs: Any) -> None:
    """Log error with additional context"""
    logger.error(message, metadata=kwargs)

def log_warning(message: str, **kwargs: Any) -> None:
    """Log warning with additional context"""
    logger.warn(message, metadata=kwargs)

def log_info(message: str, **kwargs: Any) -> None:
    """Log info with additional context"""
    logger.info(message, metadata=kwargs)

def log_debug(message: str, **kwargs: Any) -> None:
    """Log debug with additional context"""
    logger.debug(message, metadata=kwargs)
