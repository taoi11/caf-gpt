from typing import Dict
from fastapi import APIRouter, Request, HTTPException

from ...utils.logger import logger
from .agent import pace_note_agent
# from ...utils.rate_limiter import rate_limiter  # We'll implement this later

router = APIRouter()

@router.post("/generate")
async def handle_pace_note_request(request: Request) -> Dict:
    """Handle pace note generation requests"""
    
    # Get request body
    try:
        data = await request.json()
    except Exception as e:
        logger.warn('Invalid JSON received')
        raise HTTPException(status_code=400, detail="Invalid JSON")

    # Validate input
    if not data.get('input', '').strip():
        logger.warn('Empty input received')
        raise HTTPException(status_code=400, detail="Input text is required")

    # Check rate limits (to be implemented)
    # if not await rate_limiter.can_make_request(request):
    #     limits = rate_limiter.get_limit_info(request)
    #     if limits['hourly']['remaining'] == 0:
    #         raise HTTPException(status_code=429, detail="Hourly rate limit exceeded")
    #     raise HTTPException(status_code=429, detail="Daily rate limit exceeded")

    try:
        logger.debug('Generating pace note for input', {
            'input': f"{data['input'][:50]}..."
        })
        
        response = await pace_note_agent.generate_note(data)
        
        # Track successful request (to be implemented)
        # await rate_limiter.track_successful_request(request)
        
        return {
            'success': True,
            'data': response
        }

    except Exception as error:
        logger.error('Pace Note generation error', {
            'error': str(error),
            'stack': getattr(error, '__traceback__', None)
        })
        raise HTTPException(
            status_code=500,
            detail="Failed to generate pace note"
        ) 