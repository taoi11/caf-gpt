/**
 * tests/unit/iterationTracker.test.ts
 *
 * Unit tests for iterationTracker middleware
 *
 * Tests:
 * - Tool call tracking and counting
 * - Circuit breaker activation after max calls
 * - Reset functionality
 */

import { ToolMessage } from "@langchain/core/messages";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  iterationTrackerMiddleware,
  resetToolCallCount,
} from "../../src/agents/middleware/iterationTracker";

// Type definitions for tool call middleware requests
interface ToolCallRequest {
  toolCall: {
    id?: string;
    name: string;
    args: Record<string, unknown>;
  };
}

// Helper to call wrapToolCall with proper typing (non-null assertion for test safety)
async function callWrapToolCall(
  request: ToolCallRequest,
  handler: ReturnType<typeof vi.fn>
): Promise<unknown> {
  // biome-ignore lint/style/noNonNullAssertion: Test helper - method is known to exist
  return await iterationTrackerMiddleware.wrapToolCall!(request as never, handler as never);
}

describe("iterationTrackerMiddleware", () => {
  beforeEach(() => {
    resetToolCallCount();
  });

  describe("wrapToolCall", () => {
    it("should allow tool calls below max limit", async () => {
      const mockHandler = vi.fn().mockResolvedValue({ result: "success" });
      const mockRequest: ToolCallRequest = {
        toolCall: { id: "call-1", name: "research_tool", args: {} },
      };

      const result = await callWrapToolCall(mockRequest, mockHandler);

      expect(mockHandler).toHaveBeenCalledWith(mockRequest);
      expect(result).toEqual({ result: "success" });
    });

    it("should track multiple tool calls", async () => {
      const mockHandler = vi.fn().mockResolvedValue({ result: "success" });

      await callWrapToolCall({ toolCall: { id: "call-1", name: "tool1", args: {} } }, mockHandler);
      await callWrapToolCall({ toolCall: { id: "call-2", name: "tool2", args: {} } }, mockHandler);
      await callWrapToolCall({ toolCall: { id: "call-3", name: "tool3", args: {} } }, mockHandler);

      expect(mockHandler).toHaveBeenCalledTimes(3);
    });

    it("should return ToolMessage when exceeding max calls", async () => {
      const mockHandler = vi.fn().mockResolvedValue({ result: "success" });

      await callWrapToolCall({ toolCall: { id: "call-1", name: "tool1", args: {} } }, mockHandler);
      await callWrapToolCall({ toolCall: { id: "call-2", name: "tool2", args: {} } }, mockHandler);
      await callWrapToolCall({ toolCall: { id: "call-3", name: "tool3", args: {} } }, mockHandler);

      const result = await callWrapToolCall(
        { toolCall: { id: "call-4", name: "tool4", args: {} } },
        mockHandler
      );

      expect(result).toBeInstanceOf(ToolMessage);
      expect((result as ToolMessage).content).toContain("Research limit reached");
      expect((result as ToolMessage).content).toContain("3 tool calls maximum");
      expect((result as ToolMessage).tool_call_id).toBe("call-4");
    });

    it("should not call handler after exceeding max calls", async () => {
      const mockHandler = vi.fn().mockResolvedValue({ result: "success" });

      await callWrapToolCall({ toolCall: { id: "call-1", name: "tool1", args: {} } }, mockHandler);
      await callWrapToolCall({ toolCall: { id: "call-2", name: "tool2", args: {} } }, mockHandler);
      await callWrapToolCall({ toolCall: { id: "call-3", name: "tool3", args: {} } }, mockHandler);

      mockHandler.mockClear();

      await callWrapToolCall({ toolCall: { id: "call-4", name: "tool4", args: {} } }, mockHandler);

      expect(mockHandler).not.toHaveBeenCalled();
    });

    it("should continue blocking after exceeding limit", async () => {
      const mockHandler = vi.fn().mockResolvedValue({ result: "success" });

      for (let i = 1; i <= 5; i++) {
        await callWrapToolCall(
          { toolCall: { id: `call-${i}`, name: `tool${i}`, args: {} } },
          mockHandler
        );
      }

      expect(mockHandler).toHaveBeenCalledTimes(3);

      const lastResult = await callWrapToolCall(
        { toolCall: { id: "call-6", name: "tool6", args: {} } },
        mockHandler
      );

      expect(lastResult).toBeInstanceOf(ToolMessage);
    });

    it("should use 'unknown' tool_call_id when id is missing", async () => {
      const mockHandler = vi.fn().mockResolvedValue({ result: "success" });

      await callWrapToolCall({ toolCall: { name: "tool1", args: {} } }, mockHandler);
      await callWrapToolCall({ toolCall: { name: "tool2", args: {} } }, mockHandler);
      await callWrapToolCall({ toolCall: { name: "tool3", args: {} } }, mockHandler);

      const result = await callWrapToolCall({ toolCall: { name: "tool4", args: {} } }, mockHandler);

      expect((result as ToolMessage).tool_call_id).toBe("unknown");
    });
  });

  describe("resetToolCallCount", () => {
    it("should reset counter to allow new calls", async () => {
      const mockHandler = vi.fn().mockResolvedValue({ result: "success" });

      for (let i = 1; i <= 4; i++) {
        await callWrapToolCall(
          { toolCall: { id: `call-${i}`, name: `tool${i}`, args: {} } },
          mockHandler
        );
      }

      expect(mockHandler).toHaveBeenCalledTimes(3);

      resetToolCallCount();

      mockHandler.mockClear();
      const result = await callWrapToolCall(
        { toolCall: { id: "call-5", name: "tool5", args: {} } },
        mockHandler
      );

      expect(mockHandler).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ result: "success" });
    });

    it("should reset counter to zero", async () => {
      const mockHandler = vi.fn().mockResolvedValue({ result: "success" });

      await callWrapToolCall({ toolCall: { id: "call-1", name: "tool1", args: {} } }, mockHandler);
      await callWrapToolCall({ toolCall: { id: "call-2", name: "tool2", args: {} } }, mockHandler);

      resetToolCallCount();

      mockHandler.mockClear();
      for (let i = 1; i <= 3; i++) {
        await callWrapToolCall(
          { toolCall: { id: `call-${i}`, name: `tool${i}`, args: {} } },
          mockHandler
        );
      }

      expect(mockHandler).toHaveBeenCalledTimes(3);
    });
  });

  describe("Circuit Breaker Behavior", () => {
    it("should prevent infinite loops with max 3 calls", async () => {
      const mockHandler = vi.fn().mockResolvedValue({ result: "success" });

      const results: (ToolMessage | Record<string, unknown>)[] = [];
      for (let i = 1; i <= 10; i++) {
        const result = await callWrapToolCall(
          { toolCall: { id: `call-${i}`, name: `tool${i}`, args: {} } },
          mockHandler
        );
        results.push(result as ToolMessage | Record<string, unknown>);
      }

      expect(mockHandler).toHaveBeenCalledTimes(3);
      expect(results.slice(3).every((r) => r instanceof ToolMessage)).toBe(true);
    });

    it("should provide clear error message when limit reached", async () => {
      const mockHandler = vi.fn().mockResolvedValue({ result: "success" });

      for (let i = 1; i <= 3; i++) {
        await callWrapToolCall(
          { toolCall: { id: `call-${i}`, name: `tool${i}`, args: {} } },
          mockHandler
        );
      }

      const result = await callWrapToolCall(
        { toolCall: { id: "call-4", name: "tool4", args: {} } },
        mockHandler
      );

      const message = (result as ToolMessage).content as string;
      expect(message).toContain("Research limit reached");
      expect(message).toContain("3 tool calls maximum");
      expect(message).toContain("compose your final response");
    });
  });
});
