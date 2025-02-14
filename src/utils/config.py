import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Validate required environment variables
REQUIRED_VARS = [
    'PORT',
    'S3_BUCKET_NAME',
    'S3_ACCESS_KEY',
    'S3_SECRET_KEY'
]

for key in REQUIRED_VARS:
    if not os.getenv(key):
        raise ValueError(f"Missing required environment variable: {key}")

# Export environment helpers
IS_DEV = os.getenv('DEVELOPMENT', 'false').lower() == 'true'
PORT = int(os.getenv('PORT', '8080'))

# Export model configurations
MODELS = {
    'doad': {
        'finder': os.getenv('DOAD_FINDER_MODEL'),
        'chat': os.getenv('DOAD_CHAT_MODEL')
    },
    'paceNote': os.getenv('PACE_NOTE_MODEL')
}

