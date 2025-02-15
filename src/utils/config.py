import os
from dotenv import load_dotenv
from typing import Dict, Any

# Load environment variables
load_dotenv()

# Validate required environment variables
REQUIRED_VARS = [
    'EMAIL_HOST',
    'EMAIL_PASSWORD',
]  # Removed S3-related vars since they're not used yet

for key in REQUIRED_VARS:
    if not os.getenv(key):
        raise ValueError(f"Missing required environment variable: {key}")

# Export environment helpers
def _get_env(key: str, default: Any = None) -> str:
    value = os.getenv(key, default)
    if value is None:
        raise ValueError(f"Missing required environment variable: {key}")
    return value

# Export model configurations
MODELS = {
    'doad': {
        'finder': os.getenv('DOAD_FINDER_MODEL'),
        'chat': os.getenv('DOAD_CHAT_MODEL')
    },
    'paceNote': os.getenv('PACE_NOTE_MODEL')
}

# Email Configuration
EMAIL_CONFIG: Dict[str, Any] = {
    # From environment
    "host": _get_env("EMAIL_HOST"),
    "password": _get_env("EMAIL_PASSWORD"),
    "imap_port": int(_get_env("IMAP_PORT")),
    "smtp_port": int(_get_env("SMTP_PORT")),
    
    # Hardcoded values
    "username": "pacenotefoo@caf-gpt.com",  # Default inbox
    
    # System inboxes mapping
    "inboxes": {
        "pace_notes": "pacenotefoo@caf-gpt.com",
        "policy_foo": "policyfoo@caf-gpt.com"
    }
}

# Server Configuration
SERVER_CONFIG = {
    "port": int(_get_env("PORT", "8080")),
    "development": _get_env("DEVELOPMENT", "false").lower() == "true"
}

# S3 Configuration
S3_CONFIG = {
    "bucket_name": _get_env("S3_BUCKET_NAME"),
    "access_key": _get_env("S3_ACCESS_KEY"),
    "secret_key": _get_env("S3_SECRET_KEY")
}

