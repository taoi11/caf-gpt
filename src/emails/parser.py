"""Email content parsing and system detection module.
Extracts and normalizes email content from raw IMAP data, including:
- Header information (from/to/subject)
- Body content (HTML/plain text conversion)
- System detection based on recipient patterns
Provides robust error handling and logging for parsing operations."""

import re
import html
from typing import Optional
import mailparser
from mailparser.exceptions import MailParserError

from src.utils.logger import logger
from src.types import EmailMessage

try:
    import html2text
except ImportError:
    html2text = None
    logger.warn("html2text package not installed - HTML conversion will be limited")


class EmailParser:
    """Handles parsing of raw email data into structured format.
    
    Uses mailparser library to extract email content and metadata while maintaining
    error tracking and logging.
    """
    def __init__(self):
        self.parser = mailparser
        self.html_converter = None
        if html2text:
            self.html_converter = html2text.HTML2Text()
            self.html_converter.ignore_links = True
            self.html_converter.ignore_images = True

    def parse_email(self, raw_bytes: bytes, uid: int) -> Optional[EmailMessage]:
        """Parse raw email bytes into EmailMessage object.
        
        Args:
            raw_bytes: Raw email content in bytes
            uid: IMAP unique identifier for the email
            
        Returns:
            EmailMessage if parsing succeeds, None if fails
        """
        try:
            mail = self.parser.parse_from_bytes(raw_bytes)
            
            # Get primary recipient for system detection
            to_addr = mail.to[0] if mail.to else ""
            system = self._detect_system(to_addr)
            
            message = EmailMessage(
                uid=uid,
                from_addr=mail.from_[0][1] if mail.from_ else "",  # Take email part of tuple
                to_addr=[addr[1] for addr in mail.to],  # Extract email parts
                subject=mail.subject.strip() if mail.subject else "",
                body=self._get_clean_body(mail),
                system=system
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
                    if not getattr(message, f)
                ]
            })
            return None

        except (MailParserError, UnicodeError, ValueError) as e:
            logger.exception("Parse error", metadata={
                "uid": uid,
                "error": str(e),
                "error_type": type(e).__name__
            })
            return None

    def _detect_system(self, address: str) -> str:
        """Detect which system should handle this email based on address.
        
        Args:
            address: Email address to analyze
            
        Returns:
            System identifier based on email patterns
        """
        if not address:
            return ""
            
        # Extract email part if in tuple format
        if isinstance(address, tuple) and len(address) == 2:
            address = address[1]
            
        # Convert to lowercase for matching
        address = address.lower()
        
        # Define system mapping patterns
        patterns = {
            r"support@": "support",
            r"help@": "support",
            r"sales@": "sales",
            r"info@": "info",
            r"admin@": "admin"
        }
        
        # Check each pattern
        for pattern, system in patterns.items():
            if pattern in address:
                return system
                
        return "unknown"  # Default system

    def _get_clean_body(self, mail) -> str:
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
            except html2text.HTML2TextError as e:
                logger.warn(f"HTML conversion failed: {e}")
                
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
