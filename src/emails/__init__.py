"""Email processing module for handling IMAP messages."""

from src.emails.queue_add import QueueManager
from src.emails.queue import EmailQueue
from src.emails.connection import IMAPConnection
from src.emails.parser import EmailParser

__all__ = ['QueueManager', 'EmailQueue', 'IMAPConnection', 'EmailParser']
