"""Email system detection module.
Determines appropriate processing system based on email recipient patterns.
Provides clear mapping between email addresses and corresponding systems
with validation and proper error handling."""

from typing import Dict, List, Optional

from src.utils.config import EMAIL_CONFIG
from src.utils.logger import logger

# System mapping from email addresses to system identifiers
EMAIL_SYSTEM_MAPPING: Dict[str, str] = {
    "pacenotefoo@caf-gpt.com": "pace_notes",
    "policyfoo@caf-gpt.com": "policy_foo"
}

def detect_system(address: str) -> str:
    """Detect which system should handle this email based on address.
    
    Args:
        address: Email address to analyze
        
    Returns:
        System identifier based on email address, or "unknown" if no match
    """
    if not address:
        logger.warn("Empty email address provided for system detection")
        return ""
        
    # Extract email part if in tuple format
    if isinstance(address, tuple) and len(address) == 2:
        address = address[1]
        
    # Convert to lowercase for matching and strip whitespace
    normalized_address = address.lower().strip()
    
    # Direct mapping lookup
    if normalized_address in EMAIL_SYSTEM_MAPPING:
        system = EMAIL_SYSTEM_MAPPING[normalized_address]
        logger.debug(f"Detected system '{system}' for address: {address}")
        return system
            
    logger.warn(f"Unknown system for address: {address}")
    return "unknown"  # Default system

def is_valid_system(system_name: str) -> bool:
    """Check if the given system name is valid.
    
    Args:
        system_name: System name to validate
        
    Returns:
        True if system is valid, False otherwise
    """
    if not system_name:
        return False
        
    # "unknown" is a valid system designation, though not a processing system
    if system_name == "unknown":
        return True
        
    return system_name in get_all_systems()

def get_all_systems() -> List[str]:
    """Get list of all valid processing systems.
    
    Returns:
        List of all registered system names
    """
    # Get unique set of system values from the mapping
    return list(set(EMAIL_SYSTEM_MAPPING.values()))

def get_system_mailbox(system: str) -> Optional[str]:
    """Get mailbox path for a given system.
    
    Args:
        system: System identifier
        
    Returns:
        Mailbox path or None if system is invalid
    """
    if not system or system == "unknown":
        return None
        
    # Get mailbox configuration from EMAIL_CONFIG
    if hasattr(EMAIL_CONFIG, 'mailboxes') and system in EMAIL_CONFIG['mailboxes']:
        return EMAIL_CONFIG['mailboxes'][system]
        
    return None 