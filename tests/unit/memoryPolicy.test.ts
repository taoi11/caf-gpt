import { describe, expect, it } from "vitest";

import {
  MEMORY_VERSION_LIMIT,
  MEMORY_VERSION_RETENTION_MS,
  retainMemoryVersions,
} from "../../src/agents/memoryPolicy";

describe("retainMemoryVersions", () => {
  it("keeps at most the last 10 recent snapshots", () => {
    const now = Date.now();
    const versions = Array.from({ length: 12 }, (_, index) => ({
      ts: now - (12 - index) * 1000,
      text: `memory-${index + 1}`,
    }));

    const retained = retainMemoryVersions(versions, now);

    expect(retained).toHaveLength(MEMORY_VERSION_LIMIT);
    expect(retained.map((version) => version.text)).toEqual([
      "memory-3",
      "memory-4",
      "memory-5",
      "memory-6",
      "memory-7",
      "memory-8",
      "memory-9",
      "memory-10",
      "memory-11",
      "memory-12",
    ]);
  });

  it("keeps only the newest expired snapshot as the dormant-user fallback", () => {
    const now = Date.now();
    const retained = retainMemoryVersions(
      [
        { ts: now - MEMORY_VERSION_RETENTION_MS - 3000, text: "oldest" },
        { ts: now - MEMORY_VERSION_RETENTION_MS - 1000, text: "newest-expired" },
      ],
      now
    );

    expect(retained).toEqual([
      { ts: now - MEMORY_VERSION_RETENTION_MS - 1000, text: "newest-expired" },
    ]);
  });

  it("keeps one expired fallback alongside recent snapshots without exceeding 10", () => {
    const now = Date.now();
    const versions = [
      { ts: now - MEMORY_VERSION_RETENTION_MS - 2000, text: "expired-old" },
      { ts: now - MEMORY_VERSION_RETENTION_MS - 1000, text: "expired-fallback" },
      ...Array.from({ length: 11 }, (_, index) => ({
        ts: now - (11 - index) * 1000,
        text: `recent-${index + 1}`,
      })),
    ];

    const retained = retainMemoryVersions(versions, now);

    expect(retained).toHaveLength(MEMORY_VERSION_LIMIT);
    expect(retained[0].text).toBe("expired-fallback");
    expect(retained.slice(1).map((version) => version.text)).toEqual([
      "recent-3",
      "recent-4",
      "recent-5",
      "recent-6",
      "recent-7",
      "recent-8",
      "recent-9",
      "recent-10",
      "recent-11",
    ]);
  });
});
