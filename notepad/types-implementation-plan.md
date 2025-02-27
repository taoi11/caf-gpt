# Server Types Implementation Plan

## Overview
This plan outlines the steps to create and integrate a centralized server-side types file (`src/server/types.ts`) to standardize type definitions across the CAF-GPT application.

## Steps

### 1. Create the Types File

Create the file `src/server/types.ts` with all the type definitions organized by component as detailed in the `server-types-implementation.md` file.

### 2. Update Existing Files

The following files will need to be updated to use the centralized types:

#### Cost Tracker
- `src/server/api/utils/costTracker.ts`: Update to import required types:
  ```typescript
  import { CostData, CostResponse } from '../../types';
  ```

#### Rate Limiter
- `src/server/api/utils/rateLimiter.ts`: Update to import required types:
  ```typescript
  import { 
    RateLimiterConfig, 
    RequestWindow, 
    RateLimiterState,
    RateLimitInfo 
  } from '../../types';
  ```

#### LLM Gateway
- `src/server/api/utils/llmGateway.ts`: Update to import required types:
  ```typescript
  import { 
    LLMProvider, 
    MessageRole, 
    LLMMessage, 
    LLMRequestOptions, 
    LLMResponse 
  } from '../../types';
  ```

#### S3 Client
- `src/server/api/utils/s3Client.ts`: Update to import required types:
  ```typescript
  import { S3Config, S3ObjectMetadata } from '../../types';
  ```

#### Pace Notes API
- `src/server/api/paceNotes/paceNotes.ts`: Update to import required types:
  ```typescript
  import { 
    PaceNoteRequest,
    PaceNoteResponse,
    RateLimitInfo
  } from '../../types';
  ```
- `src/server/api/paceNotes/paceNoteAgent.ts`: Update to import required types:
  ```typescript
  import { 
    Competency,
    LLMMessage, 
    MessageRole 
  } from '../../types';
  ```

#### Policy Tool API
- `src/server/api/policyFoo/policyFoo.ts`: Update to import required types:
  ```typescript
  import { 
    PolicyRequest, 
    PolicyResponse, 
    PolicyMessage 
  } from '../../types';
  ```

- `src/server/api/policyFoo/doad/doadFoo.ts`: Update to import required types:
  ```typescript
  import { 
    DOADPolicyReference,
    DOADPolicyContent,
    DOADChatRequest,
    DOADChatResponse
  } from '../../../types';
  ```

#### Error Handling
- `src/server/api/utils/errorHandler.ts` (if exists): Update to import required types:
  ```typescript
  import { ErrorCode, ErrorResponse } from '../../types';
  ```

#### Server Configuration
- `src/server/config.ts` (if exists): Update to import required types:
  ```typescript
  import { EnvConfig, RateLimiterConfig } from './types';
  ```

### 3. Update Response Types

Update API endpoint response handlers to use the `RateLimitedResponse<T>` type:

```typescript
import { RateLimitedResponse, PaceNoteResponse } from '../../types';

// Example use in a route handler
const response: RateLimitedResponse<PaceNoteResponse> = {
  data: {
    paceNote: generatedNote,
    timestamp: new Date().toISOString(),
    rateLimit: rateLimitInfo
  },
  rateLimit: rateLimitInfo
};
```

### 4. Testing Strategy

1. Create unit tests for each component to ensure types are properly imported and used
2. Verify TypeScript compilation succeeds with strict type checking
3. Run runtime tests to ensure application behavior is unchanged

### 5. Documentation Update

Update any API documentation to reflect the centralized type system:

1. Add JSDoc comments to all type exports in `types.ts`
2. Update any existing documentation referring to types
3. Add type references to any API endpoint documentation

### 6. Future Type Additions

Guidelines for adding new types:

1. All new server-side types should be added to `src/server/types.ts`
2. Types should be organized in the appropriate section with proper JSDoc comments
3. Client-side types should remain in client-specific files
4. Shared types (used by both client and server) should be clearly marked and exported
5. Use meaningful and consistent naming conventions

## Benefits

1. Improved code organization and maintainability
2. Reduced duplication of type definitions
3. Single source of truth for type information
4. Better IDE support and autocompletion
5. Easier refactoring across the codebase 