# Server-Side Types Mapping

This document outlines all the server-side TypeScript types that should be consolidated into a central `src/server/types.ts` file. The types are organized by component.

## Cost Tracker Types

```typescript
/**
 * Represents cost data for the application with API and server costs.
 */
interface CostData {
  /** API costs in USD */
  apiCosts: number;
  /** Server costs in USD */
  serverCosts: number;
  /** ISO date string of the last cost reset */
  lastReset: string;
  /** ISO timestamp of the last cost update */
  lastUpdated: string;
}

/**
 * Response structure for the cost API endpoint.
 */
interface CostResponse {
  /** API costs in USD */
  apiCosts: number;
  /** Server costs in USD */
  serverCosts: number;
  /** ISO timestamp of the last cost update */
  lastUpdated: string;
}
```

## Rate Limiter Types

```typescript
/**
 * Configuration for the rate limiter.
 */
interface RateLimiterConfig {
  /** Number of requests allowed per hour */
  hourlyLimit: number;
  /** Number of requests allowed per day */
  dailyLimit: number;
  /** Cleanup interval in milliseconds */
  cleanupInterval: number;
  /** Whitelisted CIDR ranges */
  whitelistedCIDRs: string[];
}

/**
 * Tracks request counts for different time windows.
 */
interface RequestWindow {
  /** Timestamp when this window was created */
  timestamp: number;
  /** Number of requests in this window */
  count: number;
}

/**
 * Rate limiter state for a specific IP address.
 */
interface RateLimiterState {
  /** IP address being tracked */
  ip: string;
  /** Hourly request windows */
  hourlyWindows: RequestWindow[];
  /** Daily request windows */
  dailyWindows: RequestWindow[];
}

/**
 * Rate limit information returned to clients.
 */
interface RateLimitInfo {
  /** Remaining hourly requests */
  hourlyRemaining: number;
  /** Remaining daily requests */
  dailyRemaining: number;
  /** Total hourly limit */
  hourlyLimit: number;
  /** Total daily limit */
  dailyLimit: number;
}
```

## LLM Gateway Types

```typescript
/**
 * Supported LLM providers.
 */
enum LLMProvider {
  OPENROUTER = 'openrouter',
  OPENAI = 'openai',
}

/**
 * LLM message role.
 */
enum MessageRole {
  SYSTEM = 'system',
  USER = 'user',
  ASSISTANT = 'assistant',
}

/**
 * LLM message structure.
 */
interface LLMMessage {
  /** Role of the message sender */
  role: MessageRole;
  /** Content of the message */
  content: string;
}

/**
 * Options for an LLM request.
 */
interface LLMRequestOptions {
  /** Messages to send to the LLM */
  messages: LLMMessage[];
  /** Model to use */
  model: string;
  /** Temperature setting */
  temperature?: number;
  /** Max tokens to generate */
  maxTokens?: number;
  /** Provider to use */
  provider?: LLMProvider;
}

/**
 * Response from the LLM.
 */
interface LLMResponse {
  /** Generated content */
  content: string;
  /** Token usage information */
  usage: {
    /** Prompt tokens used */
    promptTokens: number;
    /** Completion tokens used */
    completionTokens: number;
    /** Total tokens used */
    totalTokens: number;
  };
  /** Cost of the request in USD */
  cost: number;
}
```

## S3/Storj Client Types

```typescript
/**
 * S3 client configuration.
 */
interface S3Config {
  /** S3 bucket name */
  bucketName: string;
  /** S3 access key ID */
  accessKeyId: string;
  /** S3 secret access key */
  secretAccessKey: string;
  /** S3 endpoint URL */
  endpoint: string;
}

/**
 * S3 object metadata.
 */
interface S3ObjectMetadata {
  /** Object key */
  key: string;
  /** Last modified date */
  lastModified: Date;
  /** Object size in bytes */
  size: number;
  /** ETag of the object */
  etag: string;
}
```

## Pace Notes Types

```typescript
/**
 * Competency information.
 */
interface Competency {
  /** Competency ID */
  id: string;
  /** Competency name */
  name: string;
  /** Competency description */
  description: string;
}

/**
 * Request for generating a pace note.
 */
interface PaceNoteRequest {
  /** Rank selected (1-5) */
  rank: number;
  /** User observation text */
  observation: string;
  /** IP address of the requester for rate limiting */
  ip: string;
}

/**
 * Response from the pace note generation.
 */
interface PaceNoteResponse {
  /** Generated pace note text */
  paceNote: string;
  /** Timestamp of generation */
  timestamp: string;
  /** Rate limit information */
  rateLimit: RateLimitInfo;
}
```

## Policy Tool Types

### Base Policy Types

```typescript
/**
 * Base request for all policy tools.
 */
interface PolicyRequest {
  /** User message */
  message: string;
  /** Conversation history */
  history: PolicyMessage[];
  /** IP address for rate limiting */
  ip: string;
}

/**
 * Message in policy conversation.
 */
interface PolicyMessage {
  /** Role of the message sender */
  role: MessageRole;
  /** Content of the message */
  content: string;
  /** Timestamp of the message */
  timestamp: string;
}

/**
 * Base response for all policy tools.
 */
interface PolicyResponse {
  /** Generated response text */
  response: string;
  /** Timestamp of generation */
  timestamp: string;
  /** Rate limit information */
  rateLimit: RateLimitInfo;
}
```

### DOAD Policy Types

```typescript
/**
 * DOAD policy reference.
 */
interface DOADPolicyReference {
  /** DOAD number */
  doadNumber: string;
  /** DOAD title */
  title: string;
  /** DOAD category */
  category: string;
  /** Last updated date */
  lastUpdated: string;
}

/**
 * DOAD policy content.
 */
interface DOADPolicyContent {
  /** DOAD reference information */
  reference: DOADPolicyReference;
  /** Full policy text */
  fullText: string;
  /** S3 key where the policy is stored */
  s3Key: string;
}

/**
 * Request for DOAD chat.
 */
interface DOADChatRequest extends PolicyRequest {
  /** Policy type */
  policyType: 'doad';
}

/**
 * Response from DOAD chat.
 */
interface DOADChatResponse extends PolicyResponse {
  /** Referenced DOAD policies */
  referencedPolicies?: DOADPolicyReference[];
}
```

## API Error Types

```typescript
/**
 * API error codes.
 */
enum ErrorCode {
  RATE_LIMITED = 'RATE_LIMITED',
  INVALID_REQUEST = 'INVALID_REQUEST',
  SERVER_ERROR = 'SERVER_ERROR',
  LLM_ERROR = 'LLM_ERROR',
  S3_ERROR = 'S3_ERROR',
  NOT_FOUND = 'NOT_FOUND',
}

/**
 * API error response.
 */
interface ErrorResponse {
  /** Error code */
  code: ErrorCode;
  /** Error message */
  message: string;
  /** Additional error details */
  details?: any;
}
```

## Utility Types

```typescript
/**
 * Environment configuration.
 */
interface EnvConfig {
  /** Port to run the server on */
  PORT: number;
  /** Node environment */
  NODE_ENV: 'development' | 'production' | 'test';
  /** S3 configuration */
  S3_BUCKET_NAME: string;
  S3_ACCESS_KEY_ID: string;
  S3_SECRET_ACCESS_KEY: string;
  /** LLM configuration */
  OPENROUTER_API_KEY: string;
  OPENAI_API_KEY: string;
  /** Default LLM model */
  DEFAULT_MODEL: string;
}

/**
 * HTTP response with rate limit information.
 */
interface RateLimitedResponse<T> {
  /** Response data */
  data: T;
  /** Rate limit information */
  rateLimit: RateLimitInfo;
}
```