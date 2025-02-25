# LLM Processing Module

## Overview
LLM-based email processing with system-specific handlers. Routes emails to appropriate processors and manages post-processing tasks including IMAP status updates.

## Components

### LLMRouter
- Core routing and orchestration component
- System-specific handler routing
- Queue monitoring and management
- Email processing coordination
- IMAP status management (marking as read after processing)
- Queue state updates
- Error handling and recovery
- Asynchronous processing
- Connection lifecycle management

### PaceNoteHandler
- Pace Notes specific processing
- Competency mapping
- Performance feedback generation
- Template application
- Response formatting
- System prompt management
- Error tracing

### PolicyFooHandler
- Policy lookup and analysis
- Response generation
- Context preservation
- System prompt management 
- Error handling

## Processing Flow
1. Queue Monitoring
   - Continuous async monitoring of email queue
   - Rate-limited polling for new messages
   - Priority-based processing
   
2. Email Routing
   - System identification
   - Handler selection
   - Validation before processing
   
3. Processing
   - System-specific handling
   - Template application
   - LLM prompt engineering
   - Response generation
   
4. Post-Processing
   - Mark email as read in IMAP (only after successful processing)
   - Update queue state
   - Logging and metrics
   - Error reporting

## Handler Interface
All handlers implement a common interface:
```python
async def process(self, email: EmailMessage) -> bool:
    """Process an email with this handler.
    
    Args:
        email: The email to process
        
    Returns:
        True if processing was successful, False otherwise
    """
```

## System Dependency
- Email module provides the queue
- IMAP connection required for marking as read
- External LLM services for processing

## Error Handling
- Connection failures
- Processing timeouts
- LLM service errors
- Invalid email content
- Retry management

## Future Improvements
- Additional handlers for new systems
- More sophisticated routing
- Parallel processing
- Rate limiting
- Caching for improved performance 