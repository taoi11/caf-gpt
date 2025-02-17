# Required Code Changes

## src/emails/queue.py

1. Add retry mechanism:
   - Add `_delayed_add` async method
   - Modify `add_email` to handle retries
   - Add retry tracking in metadata
   - Add exponential backoff calculation

## src/utils/logger.py

1. Update PII handling:
   - Add production mode metadata filtering
   - Modify debug/info level handling
   - Update metadata sanitization
   - Add environment-based metadata handling

Example changes needed:
```python
class Logger:
    def _should_include_metadata(self, level: int) -> bool:
        """Determine if metadata should be included based on environment and level."""
        if SERVER_CONFIG['development']:
            return True
        return level >= LogLevel.INFO

    def _process_metadata(self, metadata: Optional[Dict[str, Any]], level: int) -> Optional[Dict[str, Any]]:
        """Process metadata based on environment and log level."""
        if not metadata or not self._should_include_metadata(level):
            return None
        
        if not SERVER_CONFIG['development']:
            # In production, completely omit sensitive fields
            return {
                k: v for k, v in metadata.items() 
                if k not in {'from', 'to', 'subject', 'content_preview', 'raw_content'}
            }
        
        return metadata
```

## src/emails/processor.py

1. Update to support retry mechanism:
   - Add retry tracking
   - Handle failed email processing
   - Update queue interaction

## src/types.py

1. Add/update type definitions:
   - Add retry-related fields to EmailMessage
   - Update health check types
   - Add metadata filtering types

## Implementation Order

1. First Phase:
   - Email queue retry mechanism
   - Logger PII handling

2. Second Phase:
   - Type system updates
   - Processor retry handling

3. Final Phase:
   - Testing updates
   - Documentation updates 