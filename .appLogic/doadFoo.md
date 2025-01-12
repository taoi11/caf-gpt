# DOAD Policy Tool Implementation

## Backend
### DOAD Agent Structure
#### doadFoo
- Manages the internal logic of the agents
- Manages the flow of information between the agents
- Gets the policies from S3
  - Full Policy: from S3 
    Bucket: policies
    key: /doad/DOAD-Number.md  example: /doad/10001-1.md

#### DOADFinder Agent
- Inherits from doadFoo
- DOAD-specific policy identification
- System prompts:
  - Base: src/prompts/paceNote/policyFinder.md
  - DOAD List: src/prompts/paceNote/DOAD-list-table.md
- Rate limit aware for API calls

#### DOADChat Agent
- Inherits from doadFoo
- DOAD-specific user interaction
- Get the extracted policy sections from the reader agent
- System prompt: 
  - Base: src/prompts/paceNote/chatAgent.md
  - Policies: from doadFoo
- Rate limit aware for API calls

## DOAD-Specific Data Types
- DOADPolicyReference
- DOADPolicyContent
- DOADChatResponse

## API Endpoint
`POST /llm/policyfoo/doad/generate`
- Inherits base endpoint structure
- DOAD-specific parameters and handling
- Cloudflare rate limit integration
- Clear error responses

## Recent Changes
- Rework from remove reader agent
- doadFoo now gets the policies from S3
- Passes full policies text to the chat agent
- Improved error handling
- Better request tracking