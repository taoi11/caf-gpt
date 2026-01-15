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
export class DocumentRetriever {
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
