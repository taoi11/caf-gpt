/**
 * src/agents/tools/batchResearchTool.ts
 *
 * AI SDK batch research tool - executes queries across multiple sub-agents
 *
 * Top-level declarations:
 * - createBatchResearchTool: Creates batch research tool accepting queries for leave, doad, and qro agents
 */

import { tool } from "ai";
import { z } from "zod";
import type { DoadFooAgent, LeaveFooAgent, QroFooAgent } from "../sub-agents";

const batchResearchSchema = z
  .object({
    leave_queries: z.array(z.string()).min(1).max(3).optional(),
    doad_queries: z.array(z.string()).min(1).max(3).optional(),
    qro_queries: z.array(z.string()).min(1).max(3).optional(),
  })
  .refine(
    (data) =>
      (data.leave_queries?.length ?? 0) > 0 ||
      (data.doad_queries?.length ?? 0) > 0 ||
      (data.qro_queries?.length ?? 0) > 0,
    { message: "At least one query array with at least one query must be provided" }
  );

export function createBatchResearchTool(
  leaveFooAgent: LeaveFooAgent,
  doadFooAgent: DoadFooAgent,
  qroFooAgent: QroFooAgent
) {
  const aiTool = tool({
    description:
      "Research policy questions across multiple areas simultaneously. Accepts queries for leave policy, DOAD policy, and QR&O policy.",
    inputSchema: batchResearchSchema,
    execute: async ({ leave_queries, doad_queries, qro_queries }) => {
      const results: string[] = [];

      const [leaveResults, doadResults, qroResults] = await Promise.all([
        leave_queries?.length
          ? Promise.all(
              leave_queries.map(async (query, index) => {
                const answer = await leaveFooAgent.research({ question: query });
                return `Query ${index + 1}: "${query}"\nAnswer: ${answer}\n`;
              })
            ).then((res) => ["=== Leave Policy Research ===\n", ...res].join("\n"))
          : Promise.resolve(null),
        doad_queries?.length
          ? Promise.all(
              doad_queries.map(async (query, index) => {
                const answer = await doadFooAgent.research({ question: query });
                return `Query ${index + 1}: "${query}"\nAnswer: ${answer}\n`;
              })
            ).then((res) => ["=== DOAD Policy Research ===\n", ...res].join("\n"))
          : Promise.resolve(null),
        qro_queries?.length
          ? Promise.all(
              qro_queries.map(async (query, index) => {
                const answer = await qroFooAgent.research({ question: query });
                return `Query ${index + 1}: "${query}"\nAnswer: ${answer}\n`;
              })
            ).then((res) => ["=== QR&O Policy Research ===\n", ...res].join("\n"))
          : Promise.resolve(null),
      ]);

      if (leaveResults) results.push(leaveResults);
      if (doadResults) results.push(doadResults);
      if (qroResults) results.push(qroResults);

      return results.length === 0 ? "No research queries provided." : results.join("\n");
    },
  });

  return Object.assign(aiTool, {
    schema: batchResearchSchema,
    invoke: async (input: z.infer<typeof batchResearchSchema>, context?: unknown) => {
      if (!aiTool.execute) throw new Error("Tool execute function missing");
      const executeFn = aiTool.execute as (...args: unknown[]) => unknown;
      return context !== undefined ? executeFn(input, context) : executeFn(input);
    },
  });
}
