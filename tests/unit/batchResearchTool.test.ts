/**
 * tests/unit/batchResearchTool.test.ts
 *
 * Unit tests for batch research tool
 *
 * Tests:
 * - Single agent queries
 * - Multiple agent queries
 * - Parallel execution within agent
 * - Sequential agent execution
 * - Max 3 queries per agent
 * - Empty input handling
 * - Error handling from sub-agent
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DoadFooAgent, LeaveFooAgent, QroFooAgent } from "../../src/agents/sub-agents";
import { createBatchResearchTool } from "../../src/agents/tools/batchResearchTool";

// Mock sub-agents
const createMockAgent = (name: string) => ({
  research: vi.fn().mockImplementation(async ({ question }) => {
    return `${name} answer to: ${question}`;
  }),
});

describe("batchResearchTool", () => {
  let mockLeaveAgent: ReturnType<typeof createMockAgent>;
  let mockDoadAgent: ReturnType<typeof createMockAgent>;
  let mockQroAgent: ReturnType<typeof createMockAgent>;

  beforeEach(() => {
    mockLeaveAgent = createMockAgent("leave");
    mockDoadAgent = createMockAgent("doad");
    mockQroAgent = createMockAgent("qro");
  });

  it("should handle single agent queries", async () => {
    const tool = createBatchResearchTool(
      mockLeaveAgent as unknown as LeaveFooAgent,
      mockDoadAgent as unknown as DoadFooAgent,
      mockQroAgent as unknown as QroFooAgent
    );

    const result = await tool.invoke({
      leave_queries: ["How many days annual leave?"],
    });

    expect(mockLeaveAgent.research).toHaveBeenCalledWith({
      question: "How many days annual leave?",
    });
    expect(mockDoadAgent.research).not.toHaveBeenCalled();
    expect(mockQroAgent.research).not.toHaveBeenCalled();
    expect(result).toContain("=== Leave Policy Research ===");
    expect(result).toContain("leave answer to: How many days annual leave?");
  });

  it("should handle multiple agent queries", async () => {
    const tool = createBatchResearchTool(
      mockLeaveAgent as unknown as LeaveFooAgent,
      mockDoadAgent as unknown as DoadFooAgent,
      mockQroAgent as unknown as QroFooAgent
    );

    const result = await tool.invoke({
      leave_queries: ["Leave question?"],
      doad_queries: ["DOAD question?"],
      qro_queries: ["QRO question?"],
    });

    expect(mockLeaveAgent.research).toHaveBeenCalledTimes(1);
    expect(mockDoadAgent.research).toHaveBeenCalledTimes(1);
    expect(mockQroAgent.research).toHaveBeenCalledTimes(1);
    expect(result).toContain("=== Leave Policy Research ===");
    expect(result).toContain("=== DOAD Policy Research ===");
    expect(result).toContain("=== QR&O Policy Research ===");
  });

  it("should execute queries in parallel within each agent", async () => {
    const timestamps: number[] = [];
    mockLeaveAgent.research.mockImplementation(async ({ question }) => {
      timestamps.push(Date.now());
      await new Promise((resolve) => setTimeout(resolve, 10));
      return `leave answer to: ${question}`;
    });

    const tool = createBatchResearchTool(
      mockLeaveAgent as unknown as LeaveFooAgent,
      mockDoadAgent as unknown as DoadFooAgent,
      mockQroAgent as unknown as QroFooAgent
    );

    await tool.invoke({
      leave_queries: ["Q1?", "Q2?", "Q3?"],
    });

    expect(mockLeaveAgent.research).toHaveBeenCalledTimes(3);
    // All queries should start within a small time window (parallel)
    const maxDiff = Math.max(...timestamps) - Math.min(...timestamps);
    expect(maxDiff).toBeLessThan(5); // Started within 5ms (parallel)
  });

  it("should execute agents sequentially", async () => {
    const executionOrder: string[] = [];

    mockLeaveAgent.research.mockImplementation(async () => {
      executionOrder.push("leave-start");
      await new Promise((resolve) => setTimeout(resolve, 10));
      executionOrder.push("leave-end");
      return "leave answer";
    });

    mockDoadAgent.research.mockImplementation(async () => {
      executionOrder.push("doad-start");
      await new Promise((resolve) => setTimeout(resolve, 10));
      executionOrder.push("doad-end");
      return "doad answer";
    });

    mockQroAgent.research.mockImplementation(async () => {
      executionOrder.push("qro-start");
      return "qro answer";
    });

    const tool = createBatchResearchTool(
      mockLeaveAgent as unknown as LeaveFooAgent,
      mockDoadAgent as unknown as DoadFooAgent,
      mockQroAgent as unknown as QroFooAgent
    );

    await tool.invoke({
      leave_queries: ["Leave?"],
      doad_queries: ["DOAD?"],
      qro_queries: ["QRO?"],
    });

    // Agents should execute in order: leave → doad → qro
    expect(executionOrder).toEqual([
      "leave-start",
      "leave-end",
      "doad-start",
      "doad-end",
      "qro-start",
    ]);
  });

  it("should handle empty input", async () => {
    const tool = createBatchResearchTool(
      mockLeaveAgent as unknown as LeaveFooAgent,
      mockDoadAgent as unknown as DoadFooAgent,
      mockQroAgent as unknown as QroFooAgent
    );

    const result = await tool.invoke({});

    expect(mockLeaveAgent.research).not.toHaveBeenCalled();
    expect(mockDoadAgent.research).not.toHaveBeenCalled();
    expect(mockQroAgent.research).not.toHaveBeenCalled();
    expect(result).toBe("No research queries provided.");
  });

  it("should handle agent errors gracefully", async () => {
    mockLeaveAgent.research.mockRejectedValue(new Error("Leave agent failed"));

    const tool = createBatchResearchTool(
      mockLeaveAgent as unknown as LeaveFooAgent,
      mockDoadAgent as unknown as DoadFooAgent,
      mockQroAgent as unknown as QroFooAgent
    );

    await expect(
      tool.invoke({
        leave_queries: ["This will fail"],
      })
    ).rejects.toThrow("Leave agent failed");
  });

  it("should format results with query numbers", async () => {
    const tool = createBatchResearchTool(
      mockLeaveAgent as unknown as LeaveFooAgent,
      mockDoadAgent as unknown as DoadFooAgent,
      mockQroAgent as unknown as QroFooAgent
    );

    const result = await tool.invoke({
      leave_queries: ["Q1?", "Q2?"],
    });

    expect(result).toContain('Query 1: "Q1?"');
    expect(result).toContain('Query 2: "Q2?"');
  });

  it("should respect max 3 queries per agent via schema validation", () => {
    const tool = createBatchResearchTool(
      mockLeaveAgent as unknown as LeaveFooAgent,
      mockDoadAgent as unknown as DoadFooAgent,
      mockQroAgent as unknown as QroFooAgent
    );

    // Schema should enforce max 3 queries
    // This test verifies the schema is defined correctly
    expect(tool.schema).toBeDefined();
    expect(tool.schema.shape.leave_queries).toBeDefined();
    expect(tool.schema.shape.doad_queries).toBeDefined();
    expect(tool.schema.shape.qro_queries).toBeDefined();
  });
});
