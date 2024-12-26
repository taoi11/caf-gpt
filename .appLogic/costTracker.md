# Cost Tracker Design

## Overview
Simple cost tracker for the LLM API calls.

## Implementation
Located in: 
`src/server/api/utils/costTracker.ts`
`src/server/api/middleware/costMiddleware.ts`

### Core Features
Tracks the gen id of every LLM API call.
uses the `genId` to track the cost of the LLM API call.

### Provider base logic.

#### Open Router


