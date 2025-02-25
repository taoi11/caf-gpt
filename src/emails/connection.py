"""IMAP connection management with health monitoring.
Provides robust email retrieval with connection handling, error tracking,
and automatic reconnection logic. Implements mailbox selection and message
marking capabilities with proper async patterns."""

import imaplib
import socket
import asyncio
from typing import Optional, List, NamedTuple, Dict, Any, AsyncIterator, TYPE_CHECKING
from contextlib import asynccontextmanager

from src.utils.config import EMAIL_CONFIG
from src.utils.logger import logger
from src.types import EmailMessage

# Use TYPE_CHECKING to avoid circular imports
if TYPE_CHECKING:
    from src.emails.parser import EmailParser

class IMAPConfig(NamedTuple):
    """IMAP connection configuration."""
    host: str
    port: int
    username: str
    password: str
    mailboxes: Dict[str, str]

class IMAPConnection:
    """Manages IMAP connection and email retrieval."""

    def __init__(self):
        """Initialize IMAP connection manager."""
        self.config = IMAPConfig(
            host=EMAIL_CONFIG['host'],
            port=EMAIL_CONFIG['imap_port'],
            username=EMAIL_CONFIG['username'],
            password=EMAIL_CONFIG['password'],
            mailboxes=EMAIL_CONFIG['mailboxes']
        )
        self.connection: Optional[imaplib.IMAP4] = None
        self.is_healthy = False
        self.error_count = 0
        self.last_error: Optional[str] = None
        self._lock = asyncio.Lock()
        self._parser = None  # Lazy-loaded parser

    @property
    def parser(self):
        """Lazy-load the parser to avoid circular imports."""
        if self._parser is None:
            from src.emails.parser import EmailParser
            self._parser = EmailParser()
        return self._parser

    async def connect(self) -> bool:
        """Establish IMAP connection with error tracking.
        
        Returns:
            bool: True if connection successful, False otherwise
        """
        async with self._lock:
            try:
                if self.connection:
                    try:
                        self.connection.noop()  # Check connection is alive
                        return True
                    except (imaplib.IMAP4.error, socket.error):
                        self.connection = None

                logger.debug(f"Connecting to IMAP server {self.config.host}")
                
                # Run connection creation in a thread to avoid blocking
                self.connection = await asyncio.to_thread(
                    self._create_connection
                )
                
                if not self.connection:
                    return False
                    
                self.is_healthy = True
                self.error_count = 0
                self.last_error = None

                logger.info("IMAP connection established")
                return True

            except (imaplib.IMAP4.error, socket.error, OSError) as e:
                logger.exception(f"IMAP connection failed: {str(e)}")
                self.last_error = str(e)
                self.error_count += 1
                self.is_healthy = False
                return False

    def _create_connection(self) -> Optional[imaplib.IMAP4]:
        """Create IMAP connection (runs in a separate thread).
        
        Returns:
            IMAP4 object or None if connection fails
        """
        try:
            conn = imaplib.IMAP4(self.config.host, self.config.port)
            conn.login(self.config.username, self.config.password)
            conn.select('INBOX')
            return conn
        except (imaplib.IMAP4.error, socket.error, OSError) as e:
            logger.exception(f"IMAP connection creation failed: {str(e)}")
            return None

    @asynccontextmanager
    async def connection_context(self) -> AsyncIterator[imaplib.IMAP4]:
        """Context manager for ensuring connection is available.
        
        Usage:
            async with connection.connection_context() as conn:
                # use connection
                
        Yields:
            Active IMAP connection
            
        Raises:
            ConnectionError: If connection cannot be established
        """
        if not await self.ensure_connection():
            raise ConnectionError("Could not establish IMAP connection")
            
        try:
            yield self.connection
        except (imaplib.IMAP4.error, socket.error) as e:
            # Mark connection as unhealthy on errors
            self.is_healthy = False
            self.error_count += 1
            self.last_error = str(e)
            raise

    async def get_unread_messages(self) -> List[EmailMessage]:
        """Fetch unread messages from configured mailboxes.
        
        Returns:
            List of parsed email messages
        """
        messages = []

        for _, mailbox in self.config.mailboxes.items():
            if not await self.select_folder(mailbox):
                logger.error(f"Failed to select mailbox {mailbox}")
                continue

            try:
                async with self.connection_context() as conn:
                    # Search for unread messages
                    _, message_numbers = await asyncio.to_thread(
                        conn.search, None, 'UNSEEN'
                    )

                    for num in message_numbers[0].split():
                        uid = int(num)
                        try:
                            # Fetch message without marking as read
                            _, msg_data = await asyncio.to_thread(
                                conn.fetch, num, '(BODY.PEEK[])'
                            )
                            
                            email_body = msg_data[0][1]

                            # Parse the email
                            parsed = self.parser.parse_email(email_body, uid)
                            if parsed and parsed.is_valid():
                                logger.debug("Successfully parsed message", metadata={
                                    "uid": uid,
                                    "mailbox": mailbox,
                                    "from": parsed.from_addr,
                                    "system": parsed.metadata.system
                                })
                                messages.append(parsed)
                            else:
                                logger.warn("Failed to parse message", metadata={
                                    "uid": uid,
                                    "mailbox": mailbox
                                })

                        except (imaplib.IMAP4.error, socket.error, ValueError) as e:
                            logger.error("Error processing message", metadata={
                                "uid": uid,
                                "mailbox": mailbox,
                                "error": str(e),
                                "error_type": type(e).__name__
                            })
                            continue

            except (imaplib.IMAP4.error, socket.error, ConnectionError) as e:
                logger.error("Error fetching messages", metadata={
                    "mailbox": mailbox,
                    "error": str(e),
                    "error_type": type(e).__name__
                })
                continue

        return messages

    async def ensure_connection(self) -> bool:
        """Ensure IMAP connection is active.
        
        Returns:
            True if connection is active, False otherwise
        """
        if not self.connection or not self.is_healthy:
            return await self.connect()
        return True

    async def mark_as_read(self, uid: int, mailbox: str) -> bool:
        """Mark a message as read by UID in specific mailbox.
        
        Args:
            uid: Message UID to mark
            mailbox: Mailbox containing the message
            
        Returns:
            True if successful, False otherwise
        """
        if not await self.select_folder(mailbox):
            return False

        try:
            async with self.connection_context() as conn:
                await asyncio.to_thread(
                    conn.uid, 'STORE', str(uid), '+FLAGS', r'(\Seen)'
                )
                
            logger.debug(f"Marked message {uid} as read", metadata={
                "mailbox": mailbox
            })
            return True
        except (imaplib.IMAP4.error, socket.error, ConnectionError) as e:
            logger.error(f"Error marking message {uid} as read", metadata={
                "mailbox": mailbox,
                "error": str(e)
            })
            return False

    def get_health_check(self) -> Dict[str, Any]:
        """Return connection health status.
        
        Returns:
            Dictionary with health check information
        """
        return {
            "is_healthy": self.is_healthy,
            "retry_count": self.error_count,  # Keep name for backward compatibility
            "last_error": self.last_error,
            "mailboxes": list(self.config.mailboxes.values()),
            "errors": self.error_count  # For compatibility with main.py
        }

    def is_connected(self) -> bool:
        """Check if the IMAP connection is active and healthy.
        
        Returns:
            True if connected, False otherwise
        """
        return self.connection is not None and self.is_healthy

    async def select_folder(self, mailbox: str) -> bool:
        """Select a specific IMAP mailbox.
        
        Args:
            mailbox: Mailbox name to select
            
        Returns:
            True if successful, False otherwise
        """
        if not await self.ensure_connection():
            return False

        try:
            async with self.connection_context() as conn:
                status, _ = await asyncio.to_thread(conn.select, mailbox)
                
            if status != 'OK':
                logger.error("Failed to select mailbox", metadata={
                    "mailbox": mailbox,
                    "status": status
                })
                return False
            return True
        except (imaplib.IMAP4.error, socket.error, ConnectionError) as e:
            logger.error("Error selecting mailbox", metadata={
                "mailbox": mailbox,
                "error": str(e)
            })
            return False

    async def close(self) -> None:
        """Close IMAP connection cleanly."""
        async with self._lock:
            if self.connection:
                try:
                    # Set socket timeout to prevent hanging
                    if hasattr(self.connection, 'sock') and self.connection.sock:
                        self.connection.sock.settimeout(2.0)
                    
                    # Try to close and logout with a reasonable timeout
                    try:
                        await asyncio.to_thread(self.connection.close)
                        await asyncio.to_thread(self.connection.logout)
                        logger.info("IMAP connection closed")
                    except (socket.timeout, TimeoutError):
                        logger.warning("IMAP close/logout timed out")
                    
                except (imaplib.IMAP4.error, socket.error, Exception) as error:
                    logger.error("Error closing IMAP connection", metadata={
                        "error": str(error)
                    })
                finally:
                    self.connection = None
                    self.is_healthy = False
