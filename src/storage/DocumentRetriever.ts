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

interface CacheEntry {
  content: string;
  timestamp: number;
}

// Retrieve documents from R2 bucket
export class DocumentRetriever {
  private logger: Logger;
  // ⚡ Bolt: In-memory cache for R2 documents to reduce I/O wait times
  // and R2 billing costs across multiple executions in the same worker isolate
  private static cache: Map<string, CacheEntry> = new Map();
  // Cache TTL: 1 hour (3600000 ms)
  private static readonly CACHE_TTL_MS = 3600000;
  // Max cache size to prevent memory leaks
  private static readonly MAX_CACHE_SIZE = 50;

  constructor(private r2Bucket: R2Bucket) {
    this.logger = Logger.getInstance();
  }

  // Clear the static cache (used primarily for testing)
  static clearCache(): void {
    DocumentRetriever.cache.clear();
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

      const key = `${agentName}/${filename}`;
      const now = Date.now();

      // ⚡ Bolt: Check the in-memory cache first with TTL
      const cached = DocumentRetriever.cache.get(key);
      if (cached && now - cached.timestamp < DocumentRetriever.CACHE_TTL_MS) {
        this.logger.info("Document retrieved from cache", { key });

        // Update insertion order for LRU behavior
        DocumentRetriever.cache.delete(key);
        DocumentRetriever.cache.set(key, cached);

        return cached.content;
      }

      if (!this.r2Bucket) {
        throw new StorageConnectionError("R2 bucket not available");
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

      this.logger.info("Document retrieved successfully", {
        key,
        size: content.length,
      });

      // ⚡ Bolt: Cache the retrieved content for future requests, with eviction if needed
      if (DocumentRetriever.cache.size >= DocumentRetriever.MAX_CACHE_SIZE) {
        // Evict oldest entry (Map iterates in insertion order)
        const firstKey = DocumentRetriever.cache.keys().next().value;
        if (firstKey) DocumentRetriever.cache.delete(firstKey);
      }
      DocumentRetriever.cache.set(key, { content, timestamp: now });

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
