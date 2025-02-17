"""Centralized logging system with structured logging support."""

import logging
import time
from typing import Dict, Any, Optional

from src.utils.config import SERVER_CONFIG

# Define custom log levels
class LogLevel:
    """Standard logging levels used throughout the application."""
    DEBUG = logging.DEBUG
    INFO = logging.INFO
    WARNING = logging.WARNING
    ERROR = logging.ERROR
    CRITICAL = logging.CRITICAL


class Logger:
    """Centralized logging system with structured logging and LLM request tracking support."""
    def __init__(self, name: str = 'caf-gpt'):
        self.current_level = LogLevel.DEBUG if SERVER_CONFIG['development'] else LogLevel.INFO
        self.llm_requests: Dict[str, float] = {}  # Track request start times

        # Configure logging
        self._logger = logging.getLogger(name)
        self._logger.setLevel(logging.DEBUG if SERVER_CONFIG['development'] else logging.INFO)

        # Create console handler if none exists
        if not self._logger.handlers:
            ch = logging.StreamHandler()
            formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
            ch.setFormatter(formatter)
            self._logger.addHandler(ch)

    def debug(self, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        """Log a debug message."""
        extra = {'metadata': metadata} if metadata else {}
        self._logger.debug(message, extra=extra)

    def info(self, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        """Log an info message."""
        extra = {'metadata': metadata} if metadata else {}
        self._logger.info(message, extra=extra)

    def warn(self, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        """Log a warning message."""
        extra = {'metadata': metadata} if metadata else {}
        self._logger.warning(message, extra=extra)

    def error(self, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        """Log an error message."""
        extra = {'metadata': metadata} if metadata else {}
        self._logger.error(message, extra=extra)

    def exception(self, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        """Log an exception message."""
        extra = {'metadata': metadata} if metadata else {}
        self._logger.exception(message, extra=extra)

    def _trim_system_message(self, content: str) -> str:
        """Trim system messages to prevent log flooding."""
        max_length = 500  # Maximum characters to log
        if len(content) > max_length:
            return content[:max_length] + " [TRUNCATED]"
        return content

    def _format_llm_request(self, data: Dict[str, Any], request_id: str) -> str:
        """Format LLM request data for logging."""
        content = self._trim_system_message(data['messages'][0]['content'])
        return f"LLM Request - ID: {request_id}, Model: {data['model']}, Content: {content}"

    def _format_llm_response(self, data: Dict[str, Any], request_id: str, duration_ms: int) -> str:
        """Format LLM response data for logging."""
        content = self._trim_system_message(data['choices'][0]['message']['content'])
        return f"LLM Response - ID: {request_id}, Duration: {duration_ms}ms, Content: {content}"

    async def log_llm_interaction(self, data: Dict[str, Any]) -> None:
        """Log LLM interaction details."""
        request_id = data.get('request_id', 'N/A')
        start_time = self.llm_requests.pop(request_id, None)
        duration_ms = int((time.time() - start_time) * 1000) if start_time else 'N/A'

        log_message = self._format_llm_response(data, request_id, duration_ms)
        self.info(log_message, metadata={'duration_ms': duration_ms})


# Export logger instance
logger = Logger()
