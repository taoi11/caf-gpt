"""Module for parsing emails and adding them to the processing queue."""

import asyncio
import imaplib
import socket
from typing import Dict, Any, List
from datetime import datetime

from src.utils.logger import logger
from src.emails.parser import EmailParser
from src.emails.connection import IMAPConnection
from src.emails.queue import EmailQueue
from src.types import EmailMessage, EmailHealthCheck, MetricsMetadata, RetryMetrics

class ProcessingError(Exception):
    """Custom exception for processing errors that may need retry."""
    def __init__(self, message: str, is_retryable: bool = True):
        super().__init__(message)
        self.is_retryable = is_retryable

class QueueManager:
    """Manages email parsing and queueing with retry support."""

    def __init__(self):
        self.connection = IMAPConnection()
        self.queue = EmailQueue()
        self.running = False
        self._processed_uids = set()  # Track processed message UIDs
        self.parser = EmailParser()
        self._start_time = datetime.now()
        self._message_count = 0

    async def start(self) -> None:
        """Start the email processor."""
        if self.running:
            return

        self.running = True
        logger.info("Starting email processor")

        # Initial connection
        if not self.connection.connect():
            logger.error("Failed to establish initial IMAP connection")
            self.running = False
            return

        # Start processing loop
        asyncio.create_task(self._processing_loop())

    async def stop(self) -> None:
        """Stop the email processor and cleanup resources."""
        logger.info("Shutting down email processor...")
        self.running = False
        self.queue.stop_retry_processing()

        try:
            if self.connection.is_connected():
                self.connection.close()
            logger.info("Email processor shutdown complete")
        except (imaplib.IMAP4.error, socket.error) as e:
            logger.error(f"Error during shutdown: {str(e)}")

    async def _process_message(self, message: EmailMessage) -> None:
        """Process a single email message with retry support."""
        try:
            # Simulate processing (replace with actual processing logic)
            await asyncio.sleep(1)  # Placeholder for actual processing
            
            # Record success metrics
            if message.get_retry_count() > 0:
                logger.retry.log_retry_success(
                    str(message.get_uid()),
                    message.get_retry_count()
                )
            
            self._message_count += 1

        except ProcessingError as e:
            if e.is_retryable and message.should_retry():
                self.queue.schedule_retry(message, str(e))
            else:
                logger.retry.log_retry_failure(
                    str(message.get_uid()),
                    message.get_retry_count(),
                    str(e)
                )
        except (ValueError, RuntimeError) as e:  # More specific exceptions
            logger.error(f"Error processing message: {str(e)}", metadata={
                "uid": message.get_uid(),
                "retry_count": message.get_retry_count(),
                "error_type": e.__class__.__name__
            })

    async def _processing_loop(self) -> None:
        """Main processing loop with retry support."""
        while self.running:
            try:
                # Get new messages
                messages = self.connection.get_unread_messages()
                if not messages:
                    await asyncio.sleep(5)
                    continue

                # Filter out already processed messages
                new_messages = [
                    msg for msg in messages
                    if msg.get_uid() not in self._processed_uids
                ]

                if new_messages:
                    # Add valid messages to queue
                    valid_messages = [
                        msg for msg in new_messages
                        if msg.has_valid_parsed_content()
                    ]

                    if valid_messages:
                        added = self.queue.add_emails(valid_messages)
                        logger.info(f"Added {added} messages to queue")

                        # Process messages
                        for msg in valid_messages:
                            await self._process_message(msg)
                            self._processed_uids.add(msg.get_uid())

                await asyncio.sleep(5)

            except (imaplib.IMAP4.error, socket.error) as e:
                logger.error(f"IMAP error in processing loop: {str(e)}", metadata={
                    "retry_count": self.connection.retry_count
                })
                await asyncio.sleep(5)

    def get_health_check(self) -> EmailHealthCheck:
        """Get processor health status with detailed metrics."""
        queue_stats = self.queue.get_stats()
        retry_stats = logger.retry.get_retry_stats()
        
        # Calculate retry metrics
        total_retries = sum(stats["total_attempts"] for stats in retry_stats.values() if "total_attempts" in stats)
        successful_retries = sum(1 for stats in retry_stats.values() if stats.get("final_outcome") == "success")
        
        retry_metrics: RetryMetrics = {
            "total_retries": total_retries,
            "success_rate": successful_retries / total_retries if total_retries > 0 else 0,
            "avg_attempts": total_retries / len(retry_stats) if retry_stats else 0,
            "failure_reasons": self._count_failure_reasons(retry_stats),
            "backoff_stats": self._calculate_backoff_stats(retry_stats)
        }
        
        metrics: MetricsMetadata = {
            "retry_stats": retry_metrics,
            "health": {
                "uptime_seconds": (datetime.now() - self._start_time).total_seconds(),
                "message_count": self._message_count,
                "error_count": len([s for s in retry_stats.values() if s.get("final_outcome") == "failure"])
            }
        }
        
        return {
            "running": self.running,
            "queue": queue_stats,
            "connection": self.connection.get_health_check(),
            "metrics": metrics
        }

    def _count_failure_reasons(self, retry_stats: Dict[str, Dict[str, Any]]) -> Dict[str, int]:
        """Count occurrences of each failure reason."""
        reasons: Dict[str, int] = {}
        for stats in retry_stats.values():
            if stats.get("final_outcome") == "failure":
                reason = stats.get("final_error", "unknown")
                reasons[reason] = reasons.get(reason, 0) + 1
        return reasons

    def _calculate_backoff_stats(self, retry_stats: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate statistics about backoff times."""
        backoff_times: List[float] = []
        for stats in retry_stats.values():
            attempts = stats.get("attempts", [])
            for i in range(1, len(attempts)):
                current = datetime.fromisoformat(attempts[i]["timestamp"])
                previous = datetime.fromisoformat(attempts[i-1]["timestamp"])
                backoff_times.append((current - previous).total_seconds())
        
        return {
            "avg_backoff": sum(backoff_times) / len(backoff_times) if backoff_times else 0,
            "min_backoff": min(backoff_times) if backoff_times else 0,
            "max_backoff": max(backoff_times) if backoff_times else 0
        }
