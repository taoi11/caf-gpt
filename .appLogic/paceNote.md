# Pace Notes Module

## Overview
An AI-powered tool for generating standardized performance notes for CAF Members. The system processes user observations into structured feedback using a clean, functional approach with read-only data access.

## Implementation Details

### Core Components
1. **PaceNoteAgent**
   - Reads system prompt and examples from local markdown files
   - Fetches competencies from S3 at submission time
   - Handles prompt template filling
   - Uses environment variables directly for configuration
   - Manages LLM interactions via Gateway

2. **Frontend UI**
   - Clean, responsive interface with slim navigation
   - Competency rank selector (1-5)
   - Real-time validation and feedback
   - Submit button enabled only with valid rank
   - Copy-to-clipboard functionality
   - Keyboard shortcuts (Ctrl+Enter)

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
- TypeScript throughout (client/server)
- Read-only data access pattern
- Direct environment variable usage
- No configuration interfaces
- Clean functional programming approach
- No state persistence needed

### API Endpoint
`POST /api/paceNotes/generate`
- Request:
  ```typescript
  {
    input: string;
    rank: number;
  }
  ```
- Response:
  ```typescript
  {
    success: boolean;
    data?: {
      content: string;
      timestamp: string;
    };
    error?: string;
  }
  ```

### Recent Changes
- Added competency rank selector (1-5)
- Removed format selection
- Slimmed down navigation bar
- Improved UI responsiveness
- Removed configuration interfaces
- Added submission validation
- Optimized competency fetching
- Enhanced error handling