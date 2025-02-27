"""Email content parsing module.
Extracts and normalizes email content from raw IMAP data, including:
- Header information (from/to/subject)
- Body content (HTML/plain text conversion)
Provides robust error handling and logging for parsing operations.

Key Features:
- Safe handling of malformed email formats
- Comprehensive validation of parsed content
- Detailed logging for debugging and monitoring
- Consistent type hints for better IDE support"""

import re
import html
from typing import Optional
import datetime
import mailparser
from mailparser.exceptions import MailParserError

from src.utils.logger import logger
from src.types import EmailMessage, EmailMetadata
from src.emails.detector import detect_system

try:
    import html2text
except ImportError:
    html2text = None
    logger.warn("html2text package not installed - HTML conversion will be limited")


class EmailParser:
    """Handles parsing of raw email data into structured format.
    
    Responsibilities include:
    - Extracting headers (From/To/Subject)
    - Converting HTML content to clean plain text
    - Validating parsed messages
    - Robust error handling and logging
    
    Uses mailparser library under the hood with fallback processing.
    """
    def __init__(self):
        self.parser = mailparser
        self.html_converter = None
        if html2text:
            self.html_converter = html2text.HTML2Text()
            self.html_converter.ignore_links = True
            self.html_converter.ignore_images = True

    def parse_email(self, raw_bytes: bytes, uid: int) -> Optional[EmailMessage]:
        """Parse raw email bytes into structured EmailMessage object.
        
        Args:
            raw_bytes: Raw email content bytes from IMAP server
            uid: IMAP UID of the email message
            
        Returns:
            EmailMessage object on success; None on failure
            
        Raises:
            MailParserError: If low-level parsing fails
            UnicodeError: If encoding issues occur
            ValueError: If message validation fails
        """
        """Parse raw email bytes into EmailMessage object.
        
        Args:
            raw_bytes: Raw email content in bytes
            uid: IMAP unique identifier for the email
            
        Returns:
            EmailMessage if parsing succeeds, None if fails
        """
        try:
            mail = self.parser.parse_from_bytes(raw_bytes)
            
            # Safely extract addresses with format validation
            def safe_get_address(field):
                addrs = getattr(mail, field, [])
                return addrs[0][1] if len(addrs) > 0 else ""
            
            # Extract validated addresses    
            valid_tos = [
                addr[1]
                for addr in getattr(mail, 'to', [])
                if len(addr) > 1  # Validate tuple structure  
            ]
            
            # Get primary recipient for system detection
            to_addr = safe_get_address('to')
            system = detect_system(to_addr)
            
            # Create EmailMetadata with system info
            metadata = EmailMetadata(system=system)
            
            message = EmailMessage(
                uid=uid,
                from_addr=safe_get_address('from'),
                to_addr=valid_tos,
                subject=mail.subject.strip() if mail.subject else "",
                body=self._get_clean_body(mail),
                metadata=metadata
            )
            
            if message.is_valid():
                logger.info("Email parsed successfully", metadata={
                    "uid": uid,
                    "from": message.from_addr,
                    "system": system
                })
                return message
                
            logger.warn("Parsed email failed validation", metadata={
                "uid": uid,
                "missing_fields": [
                    f for f in ["uid", "from_addr", "to_addr", "system"]
                    if not getattr(message, f, None)
                ],
                "received_at": datetime.datetime.now().isoformat(),
            })
            return None

        except (MailParserError,
                UnicodeError,
                ValueError,
                AttributeError,
                IndexError) as e:
            logger.exception("Parse error", metadata={
                "uid": uid,
                "error": str(e),
                "error_type": type(e).__name__
            })
            return None

    def _get_clean_body(self, mail) -> str:
        """Extract and sanitize email body content.
        
        Processing steps:
        1) Prefer plain text body
        2) Fallback to HTML conversion
        3) Clean whitespace/special chars
        
        Args:
            mail: Parsed message object from MailParser
            
        Returns:
            Cleaned plain text body content
        """
        """Extract and clean email body content."""
        if mail.text_plain:
            content = mail.text_plain[0] if isinstance(mail.text_plain, list) else mail.text_plain
        elif mail.text_html:
            html_content = mail.text_html[0] if isinstance(mail.text_html, list) else mail.text_html
            content = self._convert_html(html_content)
        else:
            return ""
            
        return self._clean_text(content.strip())

    def _convert_html(self, html_content: str) -> str:
        """Convert HTML to plain text."""
        if self.html_converter:
            try:
                return self.html_converter.handle(html_content)
            except (ValueError, AttributeError, TypeError) as e:
                logger.warning(f"HTML conversion failed: {e}")
                
        # Fallback to basic cleaning
        html_content = re.sub(r'<[^>]+>', ' ', html_content)
        return re.sub(r'\s+', ' ', html_content)

    def _clean_text(self, text: str) -> str:
        """Basic text cleaning."""
        if not text:
            return ""
        text = html.unescape(text)
        text = re.sub(r'\s+', ' ', text)
        return text.strip()
