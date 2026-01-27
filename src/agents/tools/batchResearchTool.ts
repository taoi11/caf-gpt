/**
 * src/agents/tools/batchResearchTool.ts
 *
 * LangChain batch research tool - executes queries across multiple sub-agents
 *
 * Top-level declarations:
 * - createBatchResearchTool: Creates batch research tool accepting queries for leave, doad, and qro agents
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { DoadFooAgent, LeaveFooAgent, QroFooAgent } from "../sub-agents";

// Schema for batch research tool
const batchResearchSchema = z.object({
  leave_queries: z.array(z.string()).max(3).optional().describe("Leave policy questions (max 3)"),
  doad_queries: z.array(z.string()).max(3).optional().describe("DOAD policy questions (max 3)"),
  qro_queries: z.array(z.string()).max(3).optional().describe("QR&O policy questions (max 3)"),
});

// Creates batch research tool from sub-agent instances
export function createBatchResearchTool(
  leaveFooAgent: LeaveFooAgent,
  doadFooAgent: DoadFooAgent,
  qroFooAgent: QroFooAgent
) {
  return tool(
    async ({ leave_queries, doad_queries, qro_queries }) => {
      const results: string[] = [];

      // Process leave queries (parallel execution within agent)
      if (leave_queries && leave_queries.length > 0) {
        results.push("=== Leave Policy Research ===\n");
        const leaveResults = await Promise.all(
          leave_queries.map(async (query, index) => {
            const answer = await leaveFooAgent.research({ question: query });
            return `Query ${index + 1}: "${query}"\nAnswer: ${answer}\n`;
          })
        );
        results.push(leaveResults.join("\n"));
      }

      // Process doad queries (parallel execution within agent)
      if (doad_queries && doad_queries.length > 0) {
        results.push("=== DOAD Policy Research ===\n");
        const doadResults = await Promise.all(
          doad_queries.map(async (query, index) => {
            const answer = await doadFooAgent.research({ question: query });
            return `Query ${index + 1}: "${query}"\nAnswer: ${answer}\n`;
          })
        );
        results.push(doadResults.join("\n"));
      }

      // Process qro queries (parallel execution within agent)
      if (qro_queries && qro_queries.length > 0) {
        results.push("=== QR&O Policy Research ===\n");
        const qroResults = await Promise.all(
          qro_queries.map(async (query, index) => {
            const answer = await qroFooAgent.research({ question: query });
            return `Query ${index + 1}: "${query}"\nAnswer: ${answer}\n`;
          })
        );
        results.push(qroResults.join("\n"));
      }

      // Return combined results or empty message
      if (results.length === 0) {
        return "No research queries provided.";
      }

      return results.join("\n");
    },
    {
      name: "batch_research",
      description:
        "Research policy questions across multiple areas simultaneously. Accepts queries for leave policy, DOAD policy, and QR&O policy. Each area can have up to 3 questions. Queries within each area execute in parallel, but areas are processed sequentially (leave → doad → qro).",
      schema: batchResearchSchema,
    }
  );
}
