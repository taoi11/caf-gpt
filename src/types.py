from typing import TypedDict, Dict, List, Optional

# Base message type used across the app
class Message(TypedDict):
    role: str
    content: str
    timestamp: Optional[str]

# LLM-specific types
class LLMResponse(TypedDict):
    content: str
    model: str
    usage: Dict[str, int]

class LLMErrorDetails(TypedDict):
    code: str
    message: str
    error_type: str

# Domain-specific types
class PaceNoteRequest(TypedDict):
    input: str
    rank: Optional[str]

class PaceNoteResponse(TypedDict):
    content: str
    timestamp: Optional[str]
    rank: Optional[str]
