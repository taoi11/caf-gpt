# Core Server Utilities

> **🤖 AI Agent Navigation** | **Domain**: Shared Infrastructure | **Usage**: Cross-Module

## 🔍 Quick Reference

**Key Services**: `ai-gateway.service.ts`, `r2.util.ts`, `db/client.ts`, `db/schema.ts`
**Usage Pattern**: Import shared services into domain modules (`src/lib/modules/*`).
**Dependencies**: Cloudflare Workers, Neon Postgres, R2 Storage.

## Purpose

This directory contains shared, non-domain-specific server-side utilities for AI, Database, and Storage. These foundational services are designed to be imported and used by all domain modules.

## Directory Structure

```
server/
├── README.md             # This documentation
├── ai-gateway.service.ts # Centralized AI/LLM service
├── r2.util.ts           # Cloudflare R2 storage utilities
└── db/                  # Database infrastructure
    ├── client.ts        # Neon Postgres connection pooling
    ├── schema.ts        # Drizzle ORM schema definitions
    └── types.ts         # Database type definitions
```

## Key Services

- **`ai-gateway.service.ts`**: Centralized service for all LLM interactions via Cloudflare AI Gateway. Handles requests, errors, and monitoring.
- **`r2.util.ts`**: Utilities for Cloudflare R2 object storage (read/write files).
- **`db/client.ts`**: Manages the Neon Postgres connection pool.
- **`db/schema.ts`**: Defines the Drizzle ORM database schema.

## Usage Example

```typescript
import { createAIGatewayService } from '$lib/server/ai-gateway.service';
import { db } from '$lib/server/db/client';
import { readFileAsText } from '$lib/server/r2.util';
```

## Principles & Development

- **Single Responsibility**: Each file provides a focused, reusable service.
- **No Domain Logic**: Only generic infrastructure, not business rules.
- **Type-Safe**: All exports are fully typed for use across modules.
- **Adding Services**: Create new files using a factory pattern (e.g., `createMyService()`).
- **Schema Changes**: Modify `db/schema.ts` using Drizzle ORM patterns.
