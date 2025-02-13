# Pace Notes Module

## Overview
An AI-powered tool for generating standardized performance notes for CAF Members. The system processes user observations into structured feedback using a clean, functional approach with read-only data access.

## Implementation Details

### Core Components
1. **PaceNoteAgent**
   ```python
   class PaceNoteAgent:
       def __init__(self, llm_gateway: LLMGateway, s3_client: S3Client):
           self.llm_gateway = llm_gateway
           self.s3_client = s3_client
           self.system_prompt = self._load_system_prompt()
           
       async def generate_note(self, observation: str, rank: int) -> str:
           competencies = await self._fetch_competencies()
           return await self._generate_with_llm(observation, rank, competencies)
   ```
   - Reads system prompt and examples from local markdown files
   - Fetches competencies from S3 at submission time
   - Handles prompt template filling
   - Uses environment variables directly for configuration
   - Manages LLM interactions via Gateway

2. **FastAPI Routes**
   ```python
   @router.post("/generate", response_model=PaceNoteResponse)
   async def generate_pace_note(
       request: PaceNoteRequest,
       agent: PaceNoteAgent = Depends(get_agent)
   ):
       return await agent.generate_note(
           request.observation,
           request.rank
       )
   ```

3. **Frontend UI**
   - Clean, responsive interface with slim navigation
   - Competency rank selector (1-5)
   - Real-time validation and feedback
   - Submit button enabled only with valid rank
   - Copy-to-clipboard functionality
   - Keyboard shortcuts (Ctrl+Enter)
   - Rate limit display with clear feedback

### Data Models
```python
class PaceNoteRequest(BaseModel):
    observation: str
    rank: int

    @validator('rank')
    def validate_rank(cls, v):
        if not 1 <= v <= 5:
            raise ValueError('Rank must be between 1 and 5')
        return v

class PaceNoteResponse(BaseModel):
    generated_note: str
    timestamp: datetime
```

### Prompt System
1. **Directory Structure**
   ```
   src/prompts/paceNote/
   ├── paceNote.md    # Main system prompt template
   └── examples.md    # Example pace notes for context
   ```

2. **Template Variables**
   - `{competency_list}`: Fetched from S3 at submission
   - `{examples}`: Example pace notes for context

### Data Flow
1. System prompts loaded from local files
2. User selects competency rank and enters observation
3. On submission:
   - Competencies fetched from S3
   - Prompt template filled
   - LLM generates structured feedback
4. Response displayed with timestamp

### Technical Details
- FastAPI for async endpoints
- Pydantic models for validation
- Read-only data access pattern
- Direct environment variable usage
- Clean async/await patterns
- No state persistence needed
