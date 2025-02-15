# LLM Integration Plan

## Core Components

### 1. LLM Router (`src/llm/__init__.py`)
```python
class LLMRouter:
    def __init__(self):
        self.pace_note = PaceNoteHandler()
        
    def route_email(self, email: EmailMessage):
        if email.get_system() == "pace_notes":
            return self.pace_note.process(email)
```

### 2. PaceNote Handler (`src/llm/pace_note/__init__.py`)
```python
class PaceNoteHandler:
    def process(self, email: EmailMessage):
        # Format email for LLM
        user_message = {
            "role": "user",
            "content": f'''
From: {email_from}
Subject: {email_subject}

{email_body}
'''
        }
        
        # Log the would-be LLM call
        logger.debug("Would send LLM request", {
            "model": MODELS['paceNote'],
            "content_length": len(user_message['content'])
        })
```

## Implementation Steps
1. Create basic LLM router
2. Implement PaceNote handler
3. Add logging for would-be LLM calls
4. Test with sample emails
