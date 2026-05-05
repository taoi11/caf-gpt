/**
 * src/storage/DocumentRetriever.ts
 *
 * Document retriever for R2 storage
 *
 * Top-level declarations:
 * - DocumentRetriever (line 15): Retrieve documents from R2 bucket
 * - getDocument (line 21): Get document content from R2 storage
 */

import { StorageConnectionError, StorageNotFoundError, StorageValidationError } from "../errors";
import { formatError, Logger } from "../Logger";

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
        filename,
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
          this.logger.info("Document retrieved from cache", { key });
          return entry.content;
        }
        // Cache expired, remove it
        DocumentRetriever.documentCache.delete(key);
      }

      const object = await this.r2Bucket.get(key);

      if (!object) {
        this.logger.warn("Document not found", { key });
        throw new StorageNotFoundError(`Document not found: ${key}`);
      }

      const content = await object.text();

      if (!content || content.trim().length === 0) {
        this.logger.warn("Document is empty", { key });
        throw new StorageNotFoundError(`Document is empty: ${key}`);
      }

      // ⚡ Bolt: Store fetched document in static cache with size limit to prevent memory leaks
      if (DocumentRetriever.documentCache.size >= DocumentRetriever.MAX_CACHE_SIZE) {
        // Simple eviction: remove the oldest inserted entry
        const oldestKey = DocumentRetriever.documentCache.keys().next().value;
        if (oldestKey !== undefined) {
          DocumentRetriever.documentCache.delete(oldestKey);
        }
      }

      DocumentRetriever.documentCache.set(key, {
        content,
        expiresAt: Date.now() + DocumentRetriever.CACHE_TTL_MS,
      });

      this.logger.info("Document retrieved successfully", {
        key,
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
        filename,
        ...formatError(error),
      });
      throw new StorageConnectionError(
        `Failed to retrieve document: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
