import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Validate required environment variables
REQUIRED_VARS = [
    'PORT',
    'LLM_API_KEY',
    'PACE_NOTE_MODEL',
    'DOAD_FINDER_MODEL',
    'DOAD_CHAT_MODEL',
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

# Time constants in milliseconds
HOUR = 60 * 60 * 1000
DAY = 24 * HOUR

# Rate limiting configuration
RATE_LIMITS = {
    'WHITELISTED_CIDRS': [
        '205.193.0.0/16',  # DND network range only
    ],
    'HOURLY_LIMIT': 10,    # 10 requests per hour
    'DAILY_LIMIT': 30,     # 30 requests per day
    'CLEANUP_INTERVAL': HOUR,
    'MAX_IPS': 10000,      # Maximum number of IPs to track
    'MAX_TIMESTAMPS_PER_WINDOW': 100,  # Maximum number of timestamps to store per window
    # Time windows
    'HOUR': HOUR,
    'DAY': DAY
}
