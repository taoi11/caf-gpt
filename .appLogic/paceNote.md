# Pace Notes Module

## Overview
An AI-powered tool for generating pace notes for CAF Members. The system processes info from the user into standardized performance notes, now packaged as a Node.js Docker container.

## Frontend Implementation
### Page Layout
- nav bar on top of page
- Text input box
  - Front and center of page
  - Text area for user input
  - submit button, anchored on bottom left of input box
- Output boxes
  - Displayed on click of submit button
  - initially shows a loading animation
  - then displays the generated notes
  - clickable link to copy notes to clipboard
  - On every click new output box is created
  - 5 most recent output boxes are displayed

### TypeScript Components
#### Core logic
1. Collects system prompt
2. Collects competencies list 
3. Collects user input
4. Formats the system prompt with competencies inserted into the prompt
5. Sends system and user messages to LLM
6. Send LLM response to frontend

### Build Process
- Client TypeScript compiles to `public/js/paceNotes/`
- Served as static files by Node.js server
- API endpoints handled by server-side TypeScript
- All TypeScript is compiled during Docker build