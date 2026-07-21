/**
 * src/storage/DocumentRetriever.ts
 *
 * Document retriever for R2 storage
 *
 * Top-level declarations:
 * - CacheEntry (line 17): Cached document content and expiration metadata
 * - DocumentRetriever (line 22): Retrieve documents from R2 bucket
 * - clearCache (line 34): Clear static document cache for tests
 * - getDocument (line 45): Get document content from R2 storage
 */

import { StorageConnectionError, StorageNotFoundError, StorageValidationError } from "../errors";
import { getSafeErrorMetadata, Logger } from "../Logger";

// Retrieve documents from R2 bucket
interface CacheEntry {
  content: string;
  expiresAt: number;
}

export class DocumentRetriever {
  // ⚡ Bolt: Cache R2 documents using a static property so that instances
  // sharing the same isolate (subsequent/concurrent fetch requests)
  // can reuse already retrieved documents instead of hitting R2.
  private static documentCache = new Map<string, CacheEntry>();
  private static readonly MAX_CACHE_SIZE = 50; // Limit size to prevent memory leaks (OOM)
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL to prevent serving stale data

  /** ⚡ Bolt: Expose a way to clear the cache, primarily for testing purposes */
  public static clearCache(): void {
    DocumentRetriever.documentCache.clear();
  }

  private logger: Logger;

  constructor(private r2Bucket: R2Bucket) {
    this.logger = Logger.getInstance();
  }

  // Get document content from R2 storage
  async getDocument(agentName: string, filename: string): Promise<string> {
    try {
      this.logger.info("Retrieving document", {
        agentName,
      });

      // Input validation
      if (!agentName || !filename) {
        throw new StorageValidationError("Invalid agent name or filename provided");
      }

      if (!this.r2Bucket) {
        throw new StorageConnectionError("R2 bucket not available");
      }

      const key = `${agentName}/${filename}`;

      // ⚡ Bolt: Return cached content if available and not expired to avoid unnecessary R2 reads
      if (DocumentRetriever.documentCache.has(key)) {
        // biome-ignore lint/style/noNonNullAssertion: Cache key is verified to exist via .has()
        const entry = DocumentRetriever.documentCache.get(key)!;
        if (Date.now() < entry.expiresAt) {
          // Refresh insertion order on hit so eviction is LRU-like rather than FIFO.
          DocumentRetriever.documentCache.delete(key);
          DocumentRetriever.documentCache.set(key, entry);
          this.logger.debug("Document retrieved from cache", { agentName });
          return entry.content;
        }
        // Cache expired, remove it
        DocumentRetriever.documentCache.delete(key);
      }

      const object = await this.r2Bucket.get(key);

      if (!object) {
        this.logger.warn("Document not found", { agentName });
        throw new StorageNotFoundError(`Document not found: ${key}`);
      }

      const content = await object.text();

      if (!content || content.trim().length === 0) {
        this.logger.warn("Document is empty", { agentName });
        throw new StorageNotFoundError(`Document is empty: ${key}`);
      }

      // ⚡ Bolt: Store fetched document in static cache.
      DocumentRetriever.documentCache.set(key, {
        content,
        expiresAt: Date.now() + DocumentRetriever.CACHE_TTL_MS,
      });

      // Keep cache strictly bounded even when concurrent requests insert around the same time.
      while (DocumentRetriever.documentCache.size > DocumentRetriever.MAX_CACHE_SIZE) {
        const oldestKey = DocumentRetriever.documentCache.keys().next().value;
        if (oldestKey === undefined) {
          break;
        }
        DocumentRetriever.documentCache.delete(oldestKey);
      }

      this.logger.info("Document retrieved successfully", {
        agentName,
        size: content.length,
      });
      return content;
    } catch (error) {
      // Re-throw typed errors
      if (
        error instanceof StorageValidationError ||
        error instanceof StorageNotFoundError ||
        error instanceof StorageConnectionError
      ) {
        throw error;
      }

      // Handle unexpected errors
      this.logger.error("Error retrieving document", {
        agentName,
        ...getSafeErrorMetadata(error),
      });
      throw new StorageConnectionError(
        `Failed to retrieve document: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
