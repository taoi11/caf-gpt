"""
Email processing core: IMAP, parsing, queueing, workflow.
Handles:
- IMAP: Connections, retrieval, health checks
- Parsing: Content extraction, normalization
- Queueing: Thread-safe, retry logic
- Workflow: Orchestration, monitoring
Components: IMAPConnection, EmailParser, EmailQueue, QueueManager
"""

from src.emails.queue_add import QueueManager
from src.emails.queue import EmailQueue
from src.emails.connection import IMAPConnection
from src.emails.parser import EmailParser

__all__ = ['QueueManager', 'EmailQueue', 'IMAPConnection', 'EmailParser']
