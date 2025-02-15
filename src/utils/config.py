import os
from dotenv import load_dotenv

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

# Email configuration
EMAIL_INBOXES = {
    'pace_notes': 'pacenotefoo@caf-gpt.com',
    'policy_foo': 'policyfoo@caf-gpt.com'
}

# Add email configuration section
EMAIL_CONFIG = {
    'host': os.getenv('EMAIL_HOST', '127.0.0.1'),
    'password': os.getenv('EMAIL_PASSWORD'),
    'imap_port': int(os.getenv('IMAP_PORT', '1143')),
    'smtp_port': int(os.getenv('SMTP_PORT', '1025')),
    'inboxes': EMAIL_INBOXES
}

