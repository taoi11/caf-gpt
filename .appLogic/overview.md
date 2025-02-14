# CAF-GPT Application Plan

## Overview
A collection of AI tools and agents for army personnel, packaged as a Python Docker container. Triggers on news emails via IMAP. Uses LLMs to formulate a response to the email.

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