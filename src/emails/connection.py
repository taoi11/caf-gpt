import imaplib
import email
from email import policy
import time
from typing import Optional, List
from datetime import datetime

from src.utils.config import EMAIL_CONFIG
from src.utils.logger import logger
from src.types import EmailMessage

class IMAPConnection:
    # Manages IMAP connection and email retrieval.
    
    def __init__(self):
        self.host = EMAIL_CONFIG['host']
        self.port = EMAIL_CONFIG['imap_port']
        self.password = EMAIL_CONFIG['password']
        self.connection: Optional[imaplib.IMAP4] = None
        self.is_healthy = False
        self.retry_count = 0
        self.last_error: Optional[str] = None

    def connect(self) -> bool:
        # Establish IMAP connection with retry logic.
        try:
            if self.connection:
                try:
                    self.connection.noop()
                    return True
                except:
                    self.connection = None

            self.connection = imaplib.IMAP4(self.host, self.port)
            self.connection.login('user', self.password)
            
            self.is_healthy = True
            self.retry_count = 0
            self.last_error = None
            
            logger.info("IMAP connection established")
            return True

        except Exception as e:
            self.is_healthy = False
            self.retry_count += 1
            self.last_error = str(e)
            
            logger.error(f"IMAP connection failed: {str(e)}")
            return False

    def get_unread_messages(self) -> List[EmailMessage]:
        # Retrieve all unread messages from IMAP server.
        if not self.ensure_connection():
            return []

        messages = []
        try:
            # Select inbox
            self.connection.select('INBOX')
            
            # Search for unread messages
            _, message_numbers = self.connection.search(None, 'UNSEEN')
            
            for num in message_numbers[0].split():
                _, msg_data = self.connection.fetch(num, '(RFC822)')
                email_body = msg_data[0][1]
                
                # Parse the email message
                msg = email.message_from_bytes(email_body, policy=policy.default)
                
                # Create EmailMessage instance
                email_msg = EmailMessage(
                    raw_content=email_body.decode('utf-8'),
                    metadata={
                        "uid": int(num),
                        "received_at": datetime.now().isoformat(),
                        "system": self._determine_system(msg["To"])
                    }
                )
                
                if email_msg.is_valid():
                    messages.append(email_msg)
                else:
                    logger.warn(f"Invalid email message: {email_msg.metadata}")

            return messages

        except Exception as e:
            logger.error(f"Error fetching messages: {str(e)}")
            self.is_healthy = False
            return []

    def _determine_system(self, to_address: str) -> Optional[str]:
        # Determine which system should handle this email.
        inboxes = EMAIL_CONFIG['inboxes']
        
        if inboxes['pace_notes'] in to_address:
            return 'pace_notes'
        elif inboxes['policy_foo'] in to_address:
            return 'policy_foo'
        return None

    def ensure_connection(self) -> bool:
        # Ensure IMAP connection is active.
        if not self.connection or not self.is_healthy:
            return self.connect()
        return True

    def mark_as_read(self, uid: int) -> bool:
        # Mark a message as read by UID.
        if not self.ensure_connection():
            return False

        try:
            self.connection.uid('STORE', str(uid), '+FLAGS', r'(\Seen)')
            return True
        except Exception as e:
            logger.error(f"Error marking message {uid} as read: {str(e)}")
            return False

    def get_health_check(self) -> dict:
        # Return connection health status.
        return {
            "is_healthy": self.is_healthy,
            "retry_count": self.retry_count,
            "last_error": self.last_error
        } 