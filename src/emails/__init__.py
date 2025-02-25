"""
Email processing core: IMAP, parsing, queueing, workflow.
Handles:
- IMAP: Connections, retrieval, health checks
- Parsing: Content extraction, normalization
- System Detection: Recipient-based routing
- Queueing: Thread-safe, async operations
- Workflow: Orchestration, monitoring
Components: IMAPConnection, EmailParser, SystemDetector, EmailQueue, QueueManager
"""

__version__ = "0.2.0"

from src.emails.manager import QueueManager
from src.emails.queue import EmailQueue
from src.emails.connection import IMAPConnection
from src.emails.parser import EmailParser
from src.emails.detector import detect_system, get_all_systems

__all__ = [
    'QueueManager', 
    'EmailQueue', 
    'IMAPConnection', 
    'EmailParser',
    'detect_system',
    'get_all_systems',
    '__version__'
]
