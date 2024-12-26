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
- Separate tracking of server and API costs
- Monthly reset on the first day of each month

### Provider Cost Logic
- OpenRouter API costs tracked per token
- Base monthly server cost included automatically

### Frontend Display
- Cost display box in top-right of navigation
- Shows total cost in CAD
- Hover to see breakdown:
  - Server cost
  - LLM API cost
- Auto-updates every minute
- USD to CAD conversion (1.70) handled in frontend

### API Endpoint
`GET /api/costs`
Response:
```json
{
    "apiCosts": number,    // USD
    "serverCosts": number, // USD
    "lastUpdated": string  // ISO timestamp
}
```

### Recent Changes
- Added separate tracking of server and API costs
- Added frontend cost display with hover breakdown
- Improved monthly reset logic for first of month
- Added cost API endpoint
- Frontend currency conversion to CAD
