/**
 * src/storage/database.ts
 *
 * Database connection factory for Hyperdrive with singleton pattern
 * Optimized for Cloudflare Workers + Neon serverless
 *
 * Top-level declarations:
 * - getSqlClient: Returns shared SQL client for a Hyperdrive binding (singleton per isolate)
 * - resetSqlClient: Clears cached client (for testing)
 */

import postgres from "postgres";

// Module-level cache survives isolate reuse across requests
let cachedSql: postgres.Sql | null = null;

/**
 * Returns a shared SQL client for the given Hyperdrive binding.
 * Uses singleton pattern to reuse connections within a Worker isolate.
 *
 * Configuration rationale:
 * - idle_timeout: 0 - Close connection immediately after query completes.
 *   This ensures waitUntil() promises resolve promptly. Hyperdrive manages
 *   the actual origin connection pool to Neon, so client-side pooling is redundant.
 * - max: 1 - Single connection per client since Hyperdrive pools at the edge.
 * - prepare: true - Use named prepared statements (Hyperdrive supports this).
 */
export function getSqlClient(hyperdrive: Hyperdrive): postgres.Sql {
  if (!cachedSql) {
    cachedSql = postgres(hyperdrive.connectionString, {
      max: 1, // Hyperdrive handles pooling; single client connection sufficient
      idle_timeout: 0, // Close immediately after query - prevents waitUntil() hanging
      prepare: true, // Named prepared statements for better performance
    });
  }
  return cachedSql;
}

// Clears cached client - primarily for testing isolation
export function resetSqlClient(): void {
  cachedSql = null;
}
