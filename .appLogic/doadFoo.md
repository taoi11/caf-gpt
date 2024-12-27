# DOAD Policy Tool Implementation

## Backend
### DOAD Agent Structure
#### doadFoo
- manages the internal logic of the agents
- manages the flow of information between the agents
- manager of all the sub tool logic.

#### DOADFinder Agent
- Inherits from doadFoo
- DOAD-specific policy identification
- System prompts:
  - Base: src/prompts/paceNote/policyFinder.md
  - DOAD List: src/prompts/paceNote/DOAD-list-table.md

#### DOADReader Agent
- Inherits from doadFoo
- DOAD-specific content extraction
- System prompt:
  - Base: src/prompts/paceNote/policyReader.md
  - Full Policy: from S3 
    Bucket: policies
    key: /doad/DOAD-Number.md  example: /doad/10001-1.md


#### DOADChat Agent
- Inherits from doadFoo
- DOAD-specific user interaction
- get the extracted policy sections from the reader agent.
- system prompt: 
  - base: src/prompts/paceNote/chatAgent.md
  - policy sections: from reader agent


## DOAD-Specific Data Types
- DOADPolicyReference
- DOADPolicyContent
- DOADChatResponse

## API Endpoint
`POST /llm/policyfoo/doad/generate`
- Inherits base endpoint structure
- DOAD-specific parameters and handling 