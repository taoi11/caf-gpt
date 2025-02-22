"""IMAP connection management and email retrieval."""

import imaplib
import socket
from typing import Optional, List, NamedTuple, Dict, Any
from datetime import datetime

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
                    self.connection.noop() # type: ignore
                    return True
                except (imaplib.IMAP4.error, socket.error):
                    self.connection = None

            logger.debug(f"Connecting to IMAP server {self.config.host}")
            self.connection = imaplib.IMAP4(self.config.host, self.config.port)
            self.connection.login(self.config.username, self.config.password)
            self.connection.select('INBOX') # type: ignore
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

        for system, folder in self.config.mailboxes.items():
            if not self.select_folder(folder):
                logger.error(f"Failed to select folder {folder}")
                continue

            try:
                # Search for unread messages # type: ignore
                _, message_numbers = self.connection.search(None, 'UNSEEN') # type: ignore

                for num in message_numbers[0].split():
                    _, msg_data = self.connection.fetch(num, '(BODY.PEEK[])') # type: ignore
                    email_body = msg_data[0][1]

                    # Parse the email using our new parser
                    parsed_content = self.parser.parse_email(email_body)

                    # Create EmailMessage instance without marking as read
                    email_msg = EmailMessage(
                        raw_content=email_body.decode('utf-8'),
                        parsed_content=parsed_content,
                        metadata={
                            "uid": int(num),
                            "received_at": datetime.now().isoformat(),
                            "system": system,
                            "folder": folder
                        },
                        is_threaded=parsed_content.get("is_threaded", False) if parsed_content else False,
                        thread_id=parsed_content.get("thread_id") if parsed_content else None
                    )

                    if email_msg.is_valid():
                        if not email_msg.has_valid_parsed_content():
                            logger.warn("Invalid parsed content", metadata={
                                "uid": email_msg.get_uid(),
                                "folder": folder
                            })
                        messages.append(email_msg)
                    else:
                        logger.warn(f"Invalid email message: {email_msg.metadata}")

            except (imaplib.IMAP4.error, socket.error) as e:
                logger.error(f"Error fetching messages from {folder}: {str(e)}", metadata={
                    "folder": folder,
                    "error": str(e),
                })
                continue

        return messages

    def _determine_system(self, to_address: str) -> Optional[str]:
        """Determine which system should handle this email."""
        inboxes = self.config.mailboxes

        if inboxes['pace_notes'] in to_address:
            return 'pace_notes'
        if inboxes['policy_foo'] in to_address:
            return 'policy_foo'
        return None

    def ensure_connection(self) -> bool:
        """Ensure IMAP connection is active."""
        if not self.connection or not self.is_healthy:
            return self.connect()
        return True

    def mark_as_read(self, uid: int, folder: str) -> bool:
        """Mark a message as read by UID in specific folder."""
        if not self.select_folder(folder):
            return False

        try:
            self.connection.uid('STORE', str(uid), '+FLAGS', r'(\Seen)') # type: ignore
            return True
        except (imaplib.IMAP4.error, socket.error) as e:
            logger.error(f"Error marking message {uid} as read in {folder}: {str(e)}")
            return False

    def get_health_check(self) -> Dict[str, Any]:
        """Return connection health status."""
        return {
            "is_healthy": self.is_healthy,
            "retry_count": self.retry_count,
            "last_error": self.last_error
        }

    def is_connected(self) -> bool:
        """Check if the IMAP connection is active and healthy."""
        return self.connection is not None and self.is_healthy

    def select_folder(self, folder_path: str) -> bool:
        """Select a specific IMAP folder/mailbox."""
        if not self.ensure_connection():
            return False

        try:
            status, _ = self.connection.select(folder_path) # type: ignore
            if status != 'OK':
                logger.error(f"Failed to select folder: {folder_path}")
                return False
            return True
        except (imaplib.IMAP4.error, socket.error) as e:
            logger.error(f"Error selecting folder {folder_path}: {str(e)}")
            return False

    def close(self) -> None:
        """Close IMAP connection cleanly."""
        if self.connection:
            try:
                self.connection.close() # type: ignore
                self.connection.logout() # type: ignore
            except (imaplib.IMAP4.error, socket.error) as e:
                logger.error(f"Error closing IMAP connection: {str(e)}")
            finally:
                self.connection = None
                self.is_healthy = False
