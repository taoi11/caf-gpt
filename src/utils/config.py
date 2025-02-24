"""Centralized configuration management for environment variables and service settings.
Handles validation of required variables and provides typed access to configuration values.
Supports email, server, S3, and model configurations with environment variable fallbacks."""

import os
from typing import Dict, Any

from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Validate required environment variables
REQUIRED_VARS = [
    'EMAIL_HOST',
    'EMAIL_PASSWORD',
    'IMAP_PORT',
    'SMTP_PORT',
    'S3_BUCKET_NAME',
    'S3_ACCESS_KEY',
    'S3_SECRET_KEY'
]

for env_var in REQUIRED_VARS:
    if not os.getenv(env_var):
        raise ValueError(f"Missing required environment variable: {env_var}")


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
    "username": "pacenotefoo@caf-gpt.com",

    # Hardcoded mailbox paths - updated to match actual IMAP paths
    "mailboxes": {
        "pace_notes": "Folders/CAF-GPT/PaceNote",
        "policy_foo": "Folders/CAF-GPT/PolicyFoo"
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
