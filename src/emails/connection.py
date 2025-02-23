"""IMAP connection management and email retrieval."""

import imaplib
import socket
from typing import Optional, List, NamedTuple, Dict, Any

from src.utils.config import EMAIL_CONFIG
from src.utils.logger import logger
from src.types import EmailMessage
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
        self.config = IMAPConfig(
            host=EMAIL_CONFIG['host'],
            port=EMAIL_CONFIG['imap_port'],
            username=EMAIL_CONFIG['username'],
            password=EMAIL_CONFIG['password'],
            mailboxes=EMAIL_CONFIG['mailboxes']
        )
        self.connection: Optional[imaplib.IMAP4] = None
        self.is_healthy = False
        self.retry_count = 0
        self.last_error: Optional[str] = None
        self.parser = EmailParser()

    def connect(self) -> bool:
        """Establish IMAP connection with retry logic."""
        try:
            if self.connection:
                try:
                    self.connection.noop()  # Check connection is alive
                    return True
                except (imaplib.IMAP4.error, socket.error):
                    self.connection = None

            logger.debug(f"Connecting to IMAP server {self.config.host}")
            self.connection = imaplib.IMAP4(self.config.host, self.config.port)
            self.connection.login(self.config.username, self.config.password)
            self.connection.select('INBOX')
            self.is_healthy = True
            self.retry_count = 0
            self.last_error = None

            logger.info("IMAP connection established")
            return True

        except (imaplib.IMAP4.error, socket.error, OSError) as e:
            logger.exception(f"IMAP connection failed: {str(e)}")
            self.last_error = str(e)
            self.retry_count += 1
            self.is_healthy = False
            return False

    def get_unread_messages(self) -> List[EmailMessage]:
        """Fetch unread messages from configured mailboxes."""
        messages = []

        for mailbox in self.config.mailboxes.values():
            if not self.select_folder(mailbox):
                logger.error(f"Failed to select mailbox {mailbox}")
                continue

            try:
                # Search for unread messages
                _, message_numbers = self.connection.search(None, 'UNSEEN')

                for num in message_numbers[0].split():
                    uid = int(num)
                    try:
                        # Fetch message without marking as read
                        _, msg_data = self.connection.fetch(num, '(BODY.PEEK[])')
                        email_body = msg_data[0][1]

                        # Parse the email
                        parsed = self.parser.parse_email(email_body, uid)
                        if parsed and parsed.is_valid():
                            logger.debug("Successfully parsed message", metadata={
                                "uid": uid,
                                "mailbox": mailbox,
                                "from": parsed.from_addr,
                                "system": parsed.system
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

            except (imaplib.IMAP4.error, socket.error) as e:
                logger.error("Error fetching messages", metadata={
                    "mailbox": mailbox,
                    "error": str(e),
                    "error_type": type(e).__name__
                })
                continue

        return messages

    def ensure_connection(self) -> bool:
        """Ensure IMAP connection is active."""
        if not self.connection or not self.is_healthy:
            return self.connect()
        return True

    def mark_as_read(self, uid: int, mailbox: str) -> bool:
        """Mark a message as read by UID in specific mailbox."""
        if not self.select_folder(mailbox):
            return False

        try:
            self.connection.uid('STORE', str(uid), '+FLAGS', r'(\Seen)')
            logger.debug(f"Marked message {uid} as read", metadata={
                "mailbox": mailbox
            })
            return True
        except (imaplib.IMAP4.error, socket.error) as e:
            logger.error(f"Error marking message {uid} as read", metadata={
                "mailbox": mailbox,
                "error": str(e)
            })
            return False

    def get_health_check(self) -> Dict[str, Any]:
        """Return connection health status."""
        return {
            "is_healthy": self.is_healthy,
            "retry_count": self.retry_count,
            "last_error": self.last_error,
            "mailboxes": list(self.config.mailboxes.values())
        }

    def is_connected(self) -> bool:
        """Check if the IMAP connection is active and healthy."""
        return self.connection is not None and self.is_healthy

    def select_folder(self, mailbox: str) -> bool:
        """Select a specific IMAP mailbox."""
        if not self.ensure_connection():
            return False

        try:
            status, _ = self.connection.select(mailbox)
            if status != 'OK':
                logger.error("Failed to select mailbox", metadata={
                    "mailbox": mailbox,
                    "status": status
                })
                return False
            return True
        except (imaplib.IMAP4.error, socket.error) as e:
            logger.error("Error selecting mailbox", metadata={
                "mailbox": mailbox,
                "error": str(e)
            })
            return False

    def close(self) -> None:
        """Close IMAP connection cleanly."""
        if self.connection:
            try:
                self.connection.close()
                self.connection.logout()
                logger.info("IMAP connection closed")
            except (imaplib.IMAP4.error, socket.error) as error:
                logger.error("Error closing IMAP connection", metadata={
                    "error": str(error)
                })
            finally:
                self.connection = None
                self.is_healthy = False
