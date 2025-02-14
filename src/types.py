from typing import TypedDict

class Message(TypedDict):
    role: str
    content: str
    timestamp: str | None

class PaceNoteRequest(TypedDict):
    input: str
    rank: str | None

class PaceNoteResponse(TypedDict):
    content: str
    timestamp: str | None
    rank: str | None
