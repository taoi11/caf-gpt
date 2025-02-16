import logging
from typing import Dict, Optional, Any
from mailparser import mailparser
from src.utils.logger import logger  # Use our logger instance

class EmailParser:
    def __init__(self):
        self.parser = mailparser
        self.parse_errors: Dict[str, int] = {}  # Track error types

    def parse_email(self, raw_bytes: bytes) -> Optional[Dict[str, Any]]:
        """Parse email with logging and error tracking."""
        try:
            logger.debug("Starting email parse")
            mail = self.parser.parse_from_bytes(raw_bytes)
            
            parsed = {
                "subject": mail.subject,
                "from": mail.from_,
                "to": mail.to,
                "date": mail.date,
                "body": self._get_clean_body(mail),
                "has_attachments": bool(mail.attachments_list)
            }
            
            logger.info("Email parsed successfully", metadata={
                "has_body": bool(parsed["body"]),
                "has_attachments": parsed["has_attachments"]
            })
            
            return parsed

        except Exception as e:
            error_type = type(e).__name__
            self.parse_errors[error_type] = self.parse_errors.get(error_type, 0) + 1
            logger.error(f"Parse error: {str(e)}", metadata={
                "error_type": error_type,
                "error_count": self.parse_errors[error_type]
            })
            return None

    def _get_clean_body(self, mail) -> str:
        """Get email body, preferring plain text when available."""
        # Prefer plain text if available
        if mail.text_plain:
            return mail.text_plain[0] if isinstance(mail.text_plain, list) else mail.text_plain
            
        # Fallback to HTML content if that's what we have
        if mail.text_html:
            return mail.text_html[0] if isinstance(mail.text_html, list) else mail.text_html
        
        return "" 