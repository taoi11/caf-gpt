# Core Services

## 🔍 Quick Reference

**Key Services**: `ai-gateway.service.ts`, `db/client.ts`, `db/service.ts`
**Usage Pattern**: Import shared services into domain modules (`src/lib/modules/*`).
**Dependencies**: Cloudflare Workers, Hyperdrive, Neon Postgres.

## Purpose

This directory contains shared, non-domain-specific services for AI, Database, and Storage. These foundational services are designed to be imported and used by all domain modules.

## Directory Structure

```
core/
├── README.md             # This documentation
├── ai-gateway.service.ts # Centralized AI/LLM service
├── types.ts             # Core type definitions
└── db/                  # Database infrastructure
    ├── client.ts        # Hyperdrive connection management
    ├── service.ts       # Common database service patterns
    └── types.ts         # Database type definitions
```

## Key Services

- **`ai-gateway.service.ts`**: Centralized service for all LLM interactions via Cloudflare AI Gateway. Handles requests, errors, and monitoring.
- **`db/client.ts`**: Manages Hyperdrive connection pooling for optimal CF Workers performance.
- **`db/service.ts`**: Common database service patterns to reduce code duplication across modules.
- **`db/types.ts` & `types.ts`**: Shared type definitions for database operations and core functionality.

## Usage Example

```typescript
import { createAIGatewayService } from '$lib/core/ai-gateway.service';
import { BasePolicyDatabaseService } from '$lib/core/db/service';

// Example domain service extending common patterns
class MyService extends BasePolicyDatabaseService {
  constructor(hyperdrive: Hyperdrive) {
    super(hyperdrive);
  }
}
```

## Principles & Development

- **Single Responsibility**: Each file provides a focused, reusable service.
- **No Domain Logic**: Only generic infrastructure, not business rules.
- **Type-Safe**: All exports are fully typed for use across modules.
- **Adding Services**: Create new files using common service patterns extending `BasePolicyDatabaseService`.
- **Database Changes**: Update type definitions and extend existing service classes.
