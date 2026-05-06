## 2025-03-08 - Unbounded cache risk in Cloudflare Workers
**Learning:** Implementing unbounded static caching for DocumentRetriever in a worker isolate can lead to Out-Of-Memory (OOM) crashes and stale data across multiple requests over time.
**Action:** Always implement a max size limit and TTL for static caches in Cloudflare Workers to manage memory effectively and prevent serving stale documents.
