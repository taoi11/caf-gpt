# Cost Tracker Design

## Overview
Simple cost tracker for the LLM API calls, storing all costs in USD.

## Implementation
Located in: `src/server/api/utils/costTracker.ts`

### Core Features
- Tracks total cost in USD
- Includes base monthly server cost of $15.70 USD
- Simple accumulation of API call costs
- No request history storage
- No currency conversion (handled in frontend when needed)

### Provider Cost Logic
- OpenRouter API costs tracked per token
- Base monthly server cost included automatically
