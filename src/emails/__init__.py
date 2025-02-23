"""
Core email processing module for IMAP messages.
Handles:
- IMAP connections & email retrieval
- Content parsing & normalization
- Thread-safe queueing with retries
- Workflow orchestration
Components:
- IMAPConnection: Server connections
- EmailParser: Content extraction
- EmailQueue: Thread-safe processing
- QueueManager: Workflow control
"""

from src.emails.queue_add import QueueManager
from src.emails.queue import EmailQueue
from src.emails.connection import IMAPConnection
from src.emails.parser import EmailParser

__all__ = ['QueueManager', 'EmailQueue', 'IMAPConnection', 'EmailParser']
