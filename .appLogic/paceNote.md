# Pace Notes Module

## Overview
An AI-powered tool for generating pace notes for CAF Members. The system processes user observations into standardized performance notes using a clean, functional approach with read-only data access.

## Implementation Details

### Core Components
1. **PaceNoteAgent**
   - Reads system prompt from local markdown file
   - Fetches competencies list from S3 (read-only)
   - Handles prompt template filling
   - Manages LLM interactions

2. **Frontend UI**
   - Clean, responsive interface
   - Input area with format selection
   - Real-time feedback with loading states
   - Maintains history of 5 most recent outputs
   - Copy-to-clipboard functionality
   - Keyboard shortcuts (Ctrl+Enter)

### Data Flow
1. System prompt loaded from `src/prompts/paceNote.md`
2. Competencies fetched from S3 (`paceNote/cpl_mcpl.md`)
3. User input collected with format preference
4. Prompt template filled with competencies
5. LLM generates structured feedback
6. Response displayed with timestamp and metadata

### Technical Details
- TypeScript throughout (client/server)
- Read-only data access pattern
- Error handling with user feedback
- Clean functional programming approach
- No state persistence needed

### Build Process
- Client TypeScript → `public/js/`
- Server TypeScript → `dist/server/`
- Static files served by Node.js
- API endpoints for note generation
- Concurrent compilation in dev mode

### API Endpoints
`POST /api/paceNotes/generate`
- Request: `{ input: string, format?: 'text' | 'markdown' }`
- Response: `{ content: string, timestamp: string, format: string }`
- Error handling for invalid inputs and server issues