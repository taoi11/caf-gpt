# Pace Notes Module

## Overview
An AI-powered tool for generating standardized performance notes for CAF Members. The system processes user observations into structured feedback using a clean, functional approach with read-only data access.

## Implementation Details

### Core Components
1. **PaceNoteAgent**
   - Reads system prompt and examples from local markdown files
   - Fetches competencies list from S3 (read-only)
   - Handles prompt template filling
   - Manages LLM interactions via Gateway

2. **Frontend UI**
   - Clean, responsive interface
   - Input area with format selection
   - Real-time feedback with loading states
   - Maintains history of 5 most recent outputs
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
   - `{competency_list}`: Competencies from S3
   - `{examples}`: Example pace notes for context

### Data Flow
1. System prompts loaded from local files
2. Competencies fetched from S3 (`paceNote/cpl_mcpl.md`)
3. User input collected with format preference
4. Prompt template filled with:
   - Competencies from S3
   - Local examples
5. LLM generates structured feedback
6. Response displayed with timestamp

### Technical Details
- TypeScript throughout (client/server)
- Read-only data access pattern
- Comprehensive error handling
- Detailed logging system (4 levels)
- Clean functional programming approach
- No state persistence needed

### API Endpoint
`POST /api/paceNotes/generate`
- Request:
  ```typescript
  {
    input: string;
    format?: 'text' | 'markdown';
  }
  ```
- Response:
  ```typescript
  {
    success: boolean;
    data?: {
      content: string;
      timestamp: string;
      format: string;
    };
    error?: string;
  }
  ```

### Logging System
- DEBUG: Detailed development information
- INFO: General operational messages
- WARN: Warning conditions
- ERROR: Error conditions
- Environment-aware:
  - Development: Shows all logs
  - Production: INFO and above only

### Recent Changes
- Moved prompts to dedicated directory
- Added example pace notes
- Improved error handling
- Enhanced logging system
- Fixed text overflow issues
- Maintained input after submission