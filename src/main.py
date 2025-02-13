import logging
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

# Load environment variables
load_dotenv()
import os

# Configure logging
log_level = logging.DEBUG if os.getenv('DEVELOPMENT', 'false').lower() == 'true' else logging.INFO
logging.basicConfig(
    level=log_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI
app = FastAPI(title="CAF-GPT")

# Basic CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
static_dir = Path(__file__).parent.parent / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=static_dir), name="static")
    logger.info("Static files mounted from %s", static_dir)

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Import and include routers
# We'll add these as we build them
# from app.api.pace_notes import router as pace_notes_router
# from app.api.policy_foo import router as policy_foo_router
# app.include_router(pace_notes_router, prefix="/api/pace-notes", tags=["pace-notes"])
# app.include_router(policy_foo_router, prefix="/api/policy-foo", tags=["policy-foo"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=os.getenv('DEVELOPMENT', 'false').lower() == 'true',
        reload_excludes=[".*", "__pycache__"],  # Exclude dot files/dirs and cache
        reload_includes=["*.py", "*.html", "*.css", "*.js"]  # Only watch relevant files
    ) 