# Cost Tracker Design

## Overview
Simple cost tracker for the LLM API calls, storing costs in USD with file-based persistence.

## Implementation
Located in: `src/app/api/utils/cost_tracker.py`

### Core Features
- Tracks total cost in USD
- Includes base monthly server cost of $15.70 USD
- File-based persistence in data/costs.json
- Separate tracking of server and API costs
- Monthly reset on the first day of each month

### Storage Implementation
- JSON file storage in data/costs.json
- Pydantic model for type safety:
```python
class CostData(BaseModel):
    api_costs: float
    server_costs: float
    last_reset: datetime
    last_updated: datetime

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
```
- Auto-creates storage file if missing
- Maintains cost history between server restarts

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
```python
@router.get("/costs", response_model=CostResponse)
async def get_costs(
    tracker: CostTracker = Depends(get_cost_tracker)
) -> CostResponse:
    return CostResponse(
        api_costs=tracker.costs.api_costs,
        server_costs=tracker.costs.server_costs,
        last_updated=tracker.costs.last_updated
    )
```

Response Model:
```python
class CostResponse(BaseModel):
    api_costs: float      # USD
    server_costs: float   # USD
    last_updated: datetime
```

### Recent Changes
- Added separate tracking of server and API costs
- Added frontend cost display with hover breakdown
- Improved monthly reset logic for first of month
- Added cost API endpoint
- Frontend currency conversion to CAD
