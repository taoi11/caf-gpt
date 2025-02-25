# Email System Detection Fix Plan

## Issue Summary
The application is logging warnings about "Unknown system for email" because there's a mismatch between:
1. The current email parser detection logic (looking for patterns like `support@`, `sales@`, etc.)
2. The specific email addresses we need to handle: `pacenotefoo@caf-gpt.com` and `policyfoo@caf-gpt.com`

## Root Cause
- In `src/emails/parser.py`, the `_detect_system` method uses pattern matching that doesn't identify our specific email addresses
- The LLM router in `src/llm/__init__.py` only has a handler for the `pace_notes` system, and we need to add support for `policy_foo`

## Solution Approach
We'll implement a minimal fix by:
1. Simplifying the email parser to detect only the two specific email addresses
2. Ensuring the LLM router can handle both systems

### Implementation Steps

1. **Update the Email Parser**
   - Modify the `_detect_system` method in `src/emails/parser.py`
   - Replace pattern matching with direct comparison to our two specific email addresses

2. **Testing**
   - Run the application and verify that emails are correctly identified based on the exact email addresses
   - Confirm that the warning messages no longer appear

## Code Changes

### In `src/emails/parser.py`

```python
def _detect_system(self, address: str) -> str:
    """Detect which system should handle this email based on address.
    
    Args:
        address: Email address to analyze
        
    Returns:
        System identifier based on email address
    """
    if not address:
        return ""
        
    # Extract email part if in tuple format
    if isinstance(address, tuple) and len(address) == 2:
        address = address[1]
        
    # Convert to lowercase for matching
    address = address.lower().strip()
    
    # Direct matching with specific email addresses
    if address == "pacenotefoo@caf-gpt.com":
        return "pace_notes"
    elif address == "policyfoo@caf-gpt.com":
        return "policy_foo"
            
    return "unknown"  # Default system
```

### Next Steps for LLM Router

After updating the parser, we'll need to ensure the LLM router can handle the `policy_foo` system. This would require:

1. Creating a handler for `policy_foo` similar to the existing `PaceNoteHandler`
2. Updating the router's `route_email` method to route to this new handler

## Alternative Approaches

If exact email matching isn't sufficient:

1. **Mailbox-based detection**: Determine the system based on which mailbox/folder the email was retrieved from
2. **Configuration file**: Store the email-to-system mapping in a configuration file for easier updates

## Future Improvements

For a more robust solution in the future, consider:

1. **Configuration-based email mapping**: Move email address mappings to a configuration file
2. **Multiple handlers in router**: Ensure the LLM router handles both systems
3. **Logging improvements**: Add more detailed logging about why emails aren't matching expected systems

This minimal approach focuses on making the smallest change needed to fix the immediate issue while maintaining the existing code structure. 