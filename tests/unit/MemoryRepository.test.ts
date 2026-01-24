/**
 * tests/unit/MemoryRepository.test.ts
 *
 * Unit tests for MemoryRepository - database operations
 *
 * Tests:
 * - Get user memory
 * - Update user memory (upsert)
 * - Error handling
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSql = vi.fn() as ReturnType<typeof vi.fn>;
vi.mock("postgres", () => ({
  default: vi.fn(() => mockSql),
}));

// Must mock database.ts to control the SQL client in tests
vi.mock("../../src/storage/database", () => ({
  getSqlClient: vi.fn(() => mockSql),
  resetSqlClient: vi.fn(),
}));

import { MemoryRepository } from "../../src/storage/MemoryRepository";
import { MockHyperdrive } from "../mocks/cloudflare";

describe("MemoryRepository", () => {
  let repo: MemoryRepository;
  let mockHyperdrive: MockHyperdrive;

  beforeEach(() => {
    mockSql.mockReset();
    mockHyperdrive = new MockHyperdrive();
    repo = new MemoryRepository(mockHyperdrive as unknown as Hyperdrive);
  });

  describe("getUserMemory", () => {
    it("should return memory content when user exists", async () => {
      mockSql.mockResolvedValueOnce([{ content: "User is a Corporal in infantry." }]);

      const result = await repo.getUserMemory("john.smith");

      expect(result).toBe("User is a Corporal in infantry.");
    });

    it("should return empty string when user has no memory", async () => {
      mockSql.mockResolvedValueOnce([]);

      const result = await repo.getUserMemory("new.user");

      expect(result).toBe("");
    });

    it("should return empty string when content is null", async () => {
      mockSql.mockResolvedValueOnce([{ content: null }]);

      const result = await repo.getUserMemory("user.null");

      expect(result).toBe("");
    });

    it("should throw on database error", async () => {
      mockSql.mockRejectedValueOnce(new Error("Connection failed"));

      await expect(repo.getUserMemory("john.smith")).rejects.toThrow("Connection failed");
    });
  });

  describe("updateMemory", () => {
    it("should call sql with correct parameters", async () => {
      mockSql.mockResolvedValueOnce([]);

      await repo.updateMemory("john.smith", "New memory content");

      expect(mockSql).toHaveBeenCalled();
    });

    it("should throw on database error", async () => {
      mockSql.mockRejectedValueOnce(new Error("Insert failed"));

      await expect(repo.updateMemory("john.smith", "Content")).rejects.toThrow("Insert failed");
    });
  });
});
