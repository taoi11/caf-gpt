## 2025-03-08 - Unbounded cache risk in Cloudflare Workers
**Learning:** Implementing unbounded static caching for DocumentRetriever in a worker isolate can lead to Out-Of-Memory (OOM) crashes and stale data across multiple requests over time.
**Action:** Always implement a max size limit and TTL for static caches in Cloudflare Workers to manage memory effectively and prevent serving stale documents.

## 2025-05-26 - Avoid Zod string validation in hot paths
**Learning:** Initializing and parsing simple strings like email addresses with Zod in performance-critical hot paths (like inbound email routing/parsing) introduces significant unnecessary overhead compared to native regular expressions.
**Action:** Prefer using native RegExp over Zod schemas for simple string validation where high throughput and low latency are important.
