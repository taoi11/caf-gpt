# DOAD Policy Tool Implementation

## Backend
### DOAD Agent Structure
#### Base Agent (doadFoo)
- Manages the internal logic of the agents
- Manages the flow of information between agents
- Gets the policies from S3
  - Full Policy: from S3 
    - Bucket: policies
    - Key format: /doad/DOAD-Number.md
    - Example: /doad/10001-1.md

#### DOADFinder Agent
- Inherits from doadFoo
- DOAD-specific policy identification
- System prompts:
  - Base: src/prompts/policyFoo/doad/policyFinder.md
  - DOAD List: src/prompts/policyFoo/doad/DOAD-list-table.md
- Rate limit aware for API calls

#### DOADChat Agent
- Inherits from doadFoo
- DOAD-specific user interaction
- Gets extracted policy sections from reader agent
- System prompt: 
  - Base: src/prompts/policyFoo/doad/chatAgent.md
  - Policies: from doadFoo
- Rate limit aware for API calls

## Data Models
```python
class DOADPolicyReference(BaseModel):
    doad_number: str
    title: str
    section: Optional[str] = None

class DOADPolicyContent(BaseModel):
    content: str
    metadata: DOADPolicyReference

class DOADChatResponse(BaseModel):
    answer: str
    citations: List[str]
    follow_up: str = ""
```

## API Endpoint
```python
@router.post("/policyfoo/doad/generate", response_model=DOADChatResponse)
async def generate_doad_response(
    request: PolicyRequest,
    agent: DOADAgent = Depends(get_doad_agent)
) -> DOADChatResponse:
    """
    Generate DOAD policy responses with citations
    """
    return await agent.handle_message(
        request.message,
        request.conversation_history
    )
```

## Recent Changes
- Rework to remove reader agent
- doadFoo now gets policies from S3
- Passes full policies text to chat agent
- Improved error handling
- Better request tracking