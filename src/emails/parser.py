"""Email parsing module for extracting content from raw emails."""

import re
import html
from typing import Dict, Optional, Any, Union, List
import mailparser
from mailparser.exceptions import MailParserError

from src.utils.logger import logger  # Use our logger instance

try:
    import html2text
except ImportError:
    html2text = None
    logger.warn("html2text package not installed - HTML conversion will be limited")


class EmailParser:
    """Handles parsing of raw email data into structured format with error tracking.
    
    Uses mailparser library to extract email content and metadata while maintaining
    a record of parsing errors for monitoring.
    """
    def __init__(self):
        self.parser = mailparser
        self.parse_errors: Dict[str, int] = {}  # Track error types
        self.html_converter = None
        if html2text:
            self.html_converter = html2text.HTML2Text()
            self.html_converter.ignore_links = True
            self.html_converter.ignore_images = True

    def parse_email(self, raw_bytes: bytes) -> Optional[Dict[str, Any]]:
        """Parse email with logging and error tracking."""
        try:
            mail = self.parser.parse_from_bytes(raw_bytes)
            
            parsed = {
                "subject": mail.subject.strip(),
                "from": self._normalize_address(mail.from_),
                "to": [self._normalize_address(addr) for addr in mail.to],
                "date": mail.date.isoformat() if mail.date else None,
                "body": self._get_clean_body(mail),
                "has_attachments": bool(mail.attachments_list),
                "thread_id": mail.in_reply_to or (mail.references[0] if mail.references else None)
            }
            
            logger.info("Email parsed successfully")
            return parsed

        except (MailParserError, UnicodeError, ValueError) as e:
            error_type = type(e).__name__
            self.parse_errors[error_type] = self.parse_errors.get(error_type, 0) + 1
            logger.exception(f"Parse error: {str(e)}", metadata={
                "error_type": error_type,
                "error_count": self.parse_errors[error_type]
            })
            return None

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


    def _normalize_address(self, address: Union[str, List[str], tuple]) -> str:
        """Normalize email address format.
        
        Args:
            address: Email address string, list, or tuple of addresses
            
        Returns:
            str: Normalized email address (first address if multiple provided)
        """
        logger.debug(f"Normalizing address: {type(address)}, value: {address}")
        
        if not address:
            return ""
            
        # Handle list/tuple input - take first address
        if isinstance(address, (list, tuple)):
            if not address:  # Empty sequence
                return ""
            # For tuples like ('Name', 'email@example.com'), take the email part
            if isinstance(address[0], tuple) and len(address[0]) == 2:
                address = address[0][1]  # Take email part of first tuple
            else:
                address = address[0]  # Take first address
            logger.debug(f"After sequence handling: {type(address)}, value: {address}")
            
        # Extract email from "Name <email>" format
        match = re.match(r'.*?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', str(address))
        if match:
            return match.group(1)
            
        return str(address)
