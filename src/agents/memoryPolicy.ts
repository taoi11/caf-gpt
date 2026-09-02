/**
 * src/agents/memoryPolicy.ts
 *
 * Shared limits and retention rules for per-user memory.
 */

export const MEMORY_MAX_CONTENT_LENGTH = 8000;
export const MEMORY_VERSION_LIMIT = 10;
export const MEMORY_VERSION_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export interface MemoryVersion {
  ts: number;
  text: string;
}

/**
 * Keeps recent snapshots plus the newest expired snapshot as an archival fallback.
 * Cleanup is intentionally lazy: callers apply this on future memory work rather
 * than waking dormant Durable Objects only to enforce the 90-day window.
 *
 * Any future explicit forget/reset/privacy purge must clear both live memory and
 * every retained version atomically instead of relying on this retention policy.
 */
export function retainMemoryVersions(
  versions: MemoryVersion[] | undefined,
  now: number
): MemoryVersion[] {
  const cutoff = now - MEMORY_VERSION_RETENTION_MS;
  let latestExpired: MemoryVersion | undefined;
  const recent: MemoryVersion[] = [];

  for (const version of versions ?? []) {
    if (version.ts < cutoff) {
      if (!latestExpired || version.ts > latestExpired.ts) {
        latestExpired = version;
      }
    } else {
      recent.push(version);
    }
  }

  const recentLimit = latestExpired ? MEMORY_VERSION_LIMIT - 1 : MEMORY_VERSION_LIMIT;
  return [...(latestExpired ? [latestExpired] : []), ...recent.slice(-recentLimit)];
}
