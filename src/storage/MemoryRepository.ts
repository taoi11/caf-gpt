/**
 * src/storage/MemoryRepository.ts
 *
 * Repository for user memory storage using Neon Postgres via Hyperdrive
 *
 * Top-level declarations:
 * - MemoryRepository: Handles user memory CRUD operations via Hyperdrive connection pooling
 * - getUserMemory: Retrieves memory content for a user by email username
 * - updateMemory: Upserts user record and memory content
 */

import type postgres from "postgres";
import { StorageConnectionError } from "../errors";
import { formatError, Logger } from "../Logger";
import { getSqlClient } from "./database";

const MAX_CONTENT_LENGTH = 4000;

export class MemoryRepository {
  private sql: postgres.Sql;
  private logger: Logger;

  constructor(hyperdrive: Hyperdrive) {
    this.logger = Logger.getInstance();
    this.sql = getSqlClient(hyperdrive);
  }

  async getUserMemory(emailUsername: string): Promise<string> {
    try {
      this.logger.info("Fetching user memory", { emailUsername });

      const [row] = await this.sql`
        SELECT m.content 
        FROM memory m
        JOIN users u ON m.user_id = u.id
        WHERE u.email_username = ${emailUsername}
      `;

      this.logger.info("User memory fetched", {
        emailUsername,
        hasMemory: !!row?.content,
      });

      return row?.content || "";
    } catch (error) {
      this.logger.error("Failed to fetch user memory", {
        emailUsername,
        ...formatError(error),
      });
      throw new StorageConnectionError(
        `Database query failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async updateMemory(emailUsername: string, newContent: string): Promise<void> {
    try {
      if (newContent.length > MAX_CONTENT_LENGTH) {
        this.logger.warn("Memory content exceeds max length, truncating", {
          emailUsername,
          originalLength: newContent.length,
          maxLength: MAX_CONTENT_LENGTH,
        });
        newContent = newContent.substring(0, MAX_CONTENT_LENGTH);
      }

      this.logger.info("Updating user memory", {
        emailUsername,
        contentLength: newContent.length,
      });

      await this.sql`
        WITH upsert_user AS (
          INSERT INTO users (email_username)
          VALUES (${emailUsername})
          ON CONFLICT (email_username) DO UPDATE SET updated_at = NOW()
          RETURNING id
        )
        INSERT INTO memory (user_id, content)
        SELECT id, ${newContent} FROM upsert_user
        ON CONFLICT (user_id) DO UPDATE SET
          content = ${newContent},
          updated_at = NOW()
      `;

      this.logger.info("User memory updated successfully", { emailUsername });
    } catch (error) {
      this.logger.error("Failed to update user memory", {
        emailUsername,
        ...formatError(error),
      });
      throw new StorageConnectionError(
        `Database update failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
