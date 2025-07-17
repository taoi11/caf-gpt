# Core Server Utilities (`src/lib/server`)

This directory contains shared server-side utilities and infrastructure for all domain modules. These are not domain-specific, but provide foundational services and helpers for the application.

## Contents

- **ai-gateway.service.ts**  
  Shared service for interacting with the Cloudflare AI Gateway. Handles request/response, error handling, and monitoring for all AI-powered features.

- **r2.util.ts**  
  Utilities for interacting with Cloudflare R2 object storage. Used for reading/writing policy documents and other large assets.

- **db/**  
  Database infrastructure for both D1 (SQLite) and Neon Postgres:
  - `client.ts`: Connection pooling and client setup
  - `schema.ts`: Drizzle ORM schema definitions
  - `types.ts`: TypeScript types for database entities

## Principles

- **Single Responsibility:** Each file provides a focused, reusable service.
- **No Domain Logic:** Only generic infrastructure, not business rules.
- **Type-Safe:** All exports are fully typed for use across modules.

## Usage Example

```typescript
import { createAIGatewayService } from '$lib/server/ai-gateway.service';
import { db } from '$lib/server/db/client';
import { readFileAsText } from '$lib/server/r2.util';
```

> For domain-specific logic, see the corresponding module directories.
