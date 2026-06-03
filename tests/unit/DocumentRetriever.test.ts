/**
 * tests/unit/DocumentRetriever.test.ts
 *
 * Unit tests for R2 document retrieval and static cache behavior
 *
 * Tests:
 * - Reuses cached documents within TTL
 * - Refetches documents after TTL expiry
 * - Evicts least-recently-used documents when cache reaches capacity
 * - clearCache removes cached documents
 */

import { describe, expect, it, vi } from "vitest";
import { DocumentRetriever } from "../../src/storage/DocumentRetriever";

const createR2Bucket = () => {
  const get = vi.fn(async (key: string) => ({
    text: vi.fn(async () => `content:${key}`),
  }));

  return {
    bucket: { get } as unknown as R2Bucket,
    get,
  };
};

describe("DocumentRetriever", () => {
  it("should reuse cached documents within the TTL", async () => {
    const { bucket, get } = createR2Bucket();
    const retriever = new DocumentRetriever(bucket);

    const first = await retriever.getDocument("leave", "policy.md");
    const second = await retriever.getDocument("leave", "policy.md");

    expect(first).toBe("content:leave/policy.md");
    expect(second).toBe("content:leave/policy.md");
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith("leave/policy.md");
  });

  it("should refetch documents after the TTL expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    try {
      const { bucket, get } = createR2Bucket();
      const retriever = new DocumentRetriever(bucket);

      await retriever.getDocument("leave", "policy.md");
      vi.setSystemTime(new Date("2026-01-01T00:04:59Z"));
      await retriever.getDocument("leave", "policy.md");
      vi.setSystemTime(new Date("2026-01-01T00:05:01Z"));
      await retriever.getDocument("leave", "policy.md");

      expect(get).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("should evict the least-recently-used document when the cache reaches capacity", async () => {
    const { bucket, get } = createR2Bucket();
    const retriever = new DocumentRetriever(bucket);

    for (let index = 0; index < 50; index += 1) {
      await retriever.getDocument("leave", `policy-${index}.md`);
    }

    await retriever.getDocument("leave", "policy-0.md");
    await retriever.getDocument("leave", "policy-50.md");
    await retriever.getDocument("leave", "policy-0.md");
    await retriever.getDocument("leave", "policy-1.md");

    expect(get).toHaveBeenCalledTimes(52);
    expect(get).toHaveBeenNthCalledWith(51, "leave/policy-50.md");
    expect(get).toHaveBeenNthCalledWith(52, "leave/policy-1.md");
  });

  it("should clear cached documents", async () => {
    const { bucket, get } = createR2Bucket();
    const retriever = new DocumentRetriever(bucket);

    await retriever.getDocument("leave", "policy.md");
    DocumentRetriever.clearCache();
    await retriever.getDocument("leave", "policy.md");

    expect(get).toHaveBeenCalledTimes(2);
  });
});
