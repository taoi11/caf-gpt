# Email processing module
from .processor import EmailProcessor
from .queue import EmailQueue
from .connection import IMAPConnection

__all__ = ['EmailProcessor', 'EmailQueue', 'IMAPConnection'] 