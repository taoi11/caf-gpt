"""Email processing module for handling IMAP messages."""

from src.emails.processor import EmailProcessor
from src.emails.queue import EmailQueue
from src.emails.connection import IMAPConnection
from src.emails.parser import EmailParser

__all__ = ['EmailProcessor', 'EmailQueue', 'IMAPConnection', 'EmailParser']
