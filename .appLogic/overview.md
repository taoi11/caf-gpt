# CAF-GPT Application Plan

## Overview
A collection of AI tools and agents for army personnel, packaged as a Python application. Processes emails via IMAP and routes them to appropriate systems.

## Core Components

### Email Processing
1. **IMAPConnection**
   - Manages IMAP server connection
   - Handles authentication
   - Retrieves unread messages
   - Tracks connection health

2. **EmailProcessor**
   - Manages processing workflow
   - Routes messages to appropriate systems
   - Handles errors and retries
   - Maintains processing queue

## Core Principles
- Keep user messages browser-side only
- Prevent user identifiable data from entering logs
- Provide simple and minimal tool interfaces
- Use minimal dependencies and frameworks
- Maintain clear separation of client and server code
- Use read-only data access patterns
- Direct environment variable usage
- Simplified configurations
- Robust testing with clean async handling
- Cloudflare-based security and rate limiting

## Technology Stack

### Python
- **Version**: 3.12
- **Purpose**: server-side logic
- **Packages**:
  - imap_tools
  - boto3

### Testing
- **Framework**: Pytest (replaced Jest)
- **Features**:
  - Async test support
  - Proper fixture cleanup
  - High test coverage targets

### Containerization
- **Technology**: Docker

### Storage
- **Technology**: 'Storj' S3-compatible storage
- **Details**:
  - Gateway endpoint at gateway.storjshare.io
  - Read-only access configuration

## Project Structure
See [dirStructure.yaml](dirStructure.yaml) for details.

## Development vs Production Mode

### Development Mode
- **Enabled by**: DEVELOPMENT=true
- **Features**:
  - Detailed debug logging
  - Automatic application restart on changes
  - Reduced rate limiting
  - Mock services for testing
  - Verbose error messages

### Production Mode
- **Enabled by**: DEVELOPMENT=false
- **Features**:
  - Info-level logging only
  - Strict rate limiting
  - Real service connections
  - Generic error messages
  - Performance optimizations