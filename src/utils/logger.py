"""Centralized logging system with structured logging and retry tracking support.
Provides custom log levels, detailed metadata capture, and specialized retry logging
for tracking email processing attempts and outcomes."""

import logging
from typing import Dict, Any, Optional
from datetime import datetime

from src.utils.config import SERVER_CONFIG

# Define custom log levels
class LogLevel:
    """Standard logging levels used throughout the application."""
    DEBUG = logging.DEBUG
    INFO = logging.INFO
    WARNING = logging.WARNING
    ERROR = logging.ERROR
    CRITICAL = logging.CRITICAL

class RetryLogger:
    """Helper class for retry-specific logging."""
    def __init__(self, base_logger: 'Logger'):
        self._logger = base_logger
        self._retry_stats: Dict[str, Dict[str, Any]] = {}

    def log_retry_attempt(self, uid: str, attempt: int, reason: str, next_attempt: Optional[datetime] = None) -> None:
        """Log a retry attempt with details."""
        metadata = {
            "uid": uid,
            "attempt": attempt,
            "reason": reason,
            "next_attempt": next_attempt.isoformat() if next_attempt else None
        }
        self._logger.info(f"Retry attempt {attempt} for email {uid}", metadata=metadata)
        self._update_stats(uid, metadata)

    def log_retry_success(self, uid: str, total_attempts: int) -> None:
        """Log a successful retry."""
        metadata = {
            "uid": uid,
            "total_attempts": total_attempts,
            "outcome": "success"
        }
        self._logger.info(f"Email {uid} processed successfully after {total_attempts} attempts", metadata=metadata)
        self._update_stats(uid, metadata)

    def log_retry_failure(self, uid: str, total_attempts: int, final_error: str) -> None:
        """Log a final retry failure."""
        metadata = {
            "uid": uid,
            "total_attempts": total_attempts,
            "final_error": final_error,
            "outcome": "failure"
        }
        self._logger.error(f"Email {uid} failed after {total_attempts} attempts", metadata=metadata)
        self._update_stats(uid, metadata)

    def _update_stats(self, uid: str, metadata: Dict[str, Any]) -> None:
        """Update retry statistics."""
        if uid not in self._retry_stats:
            self._retry_stats[uid] = {
                "first_attempt": datetime.now().isoformat(),
                "attempts": []
            }
        
        self._retry_stats[uid]["attempts"].append({
            "timestamp": datetime.now().isoformat(),
            **metadata
        })
        
        if "outcome" in metadata:
            self._retry_stats[uid]["final_outcome"] = metadata["outcome"]
            self._retry_stats[uid]["total_attempts"] = len(self._retry_stats[uid]["attempts"])

    def get_retry_stats(self) -> Dict[str, Dict[str, Any]]:
        """Get retry statistics."""
        return self._retry_stats

class Logger:
    """Centralized logging system with structured logging and retry tracking support."""
    def __init__(self, name: str = 'caf-gpt'):
        self.current_level = LogLevel.DEBUG if SERVER_CONFIG['development'] else LogLevel.INFO
        self.retry = RetryLogger(self)

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

    def get_retry_stats(self) -> Dict[str, Dict[str, Any]]:
        """Get retry statistics from the retry logger."""
        return self.retry.get_retry_stats()

    def log_llm_interaction(self, data: Dict[str, Any]) -> None:
        """Log LLM interaction details.
        
        Args:
            data: Dictionary containing interaction details including:
                - role: The role (system/user/assistant)
                - content: The message content
                - metadata: Additional metadata like model, usage stats
        """
        self.info("LLM Interaction", metadata={
            'role': data.get('role'),
            'content_preview': data.get('content', '')[:100] + '...' if data.get('content') else '',
            **data.get('metadata', {})
        })

    # Add warning as an alias to warn for consistency with standard logger
    def warning(self, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        """Alias for warn() - log a warning message."""
        self.warn(message, metadata)

# Create a single logger instance
_logger_instance = Logger()

# Export the logger instance
logger = _logger_instance
