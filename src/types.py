from typing import Dict, List, Optional, TypedDict

class Message(TypedDict):
    role: str
    content: str
    timestamp: Optional[str]

class PaceNoteRequest(TypedDict):
    input: str
    rank: Optional[str]

class PaceNoteResponse(TypedDict):
    content: str
    timestamp: Optional[str]
    rank: Optional[str] 