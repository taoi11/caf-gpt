## 2025-03-08 - Unbounded cache risk in Cloudflare Workers
**Learning:** Implementing unbounded static caching for DocumentRetriever in a worker isolate can lead to Out-Of-Memory (OOM) crashes and stale data across multiple requests over time.
**Action:** Always implement a max size limit and TTL for static caches in Cloudflare Workers to manage memory effectively and prevent serving stale documents.

## 2025-03-08 - Native Regex vs Zod for Simple Validations
**Learning:** For high-throughput paths (like email validation), native regular expressions (`EMAIL_REGEX.test(string)`) are vastly faster and consume less memory than heavy validation libraries like Zod (`z.string().email().safeParse(string)`). Benchmarks showed Regex executing in ~15ms compared to Zod taking ~670ms for 10000 validations, about a 40-50x speed improvement.
**Action:** Prefer native RegExp over Zod schemas for simple string validation (e.g., email addresses) in performance-critical paths to avoid significant initialization and parsing overhead.
