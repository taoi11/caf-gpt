/**
 * src/agents/tools/researchTools.ts
 *
 * LangChain tools for policy research - wraps sub-agents as callable tools
 *
 * Top-level declarations:
 * - createResearchTools: Creates research tools from sub-agent instances
 * - createResearchTool: Helper to create a single research tool from an agent
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { ResearchRequest } from "../../types";
import type { DoadFooAgent, LeaveFooAgent, QroFooAgent } from "../sub-agents";

// Shared schema for all research tools
const researchSchema = z.object({
  query: z.string().describe("The specific policy question to research"),
});

// Agent interface for research capability
interface ResearchAgent {
  research: (req: ResearchRequest) => Promise<string>;
}

// Helper to create a single research tool from an agent
function createResearchTool(agent: ResearchAgent, name: string, description: string) {
  return tool(async ({ query }) => agent.research({ question: query }), {
    name,
    description,
    schema: researchSchema,
  });
}

// Creates LangChain tools from research sub-agents
export function createResearchTools(
  leaveFooAgent: LeaveFooAgent,
  doadFooAgent: DoadFooAgent,
  qroFooAgent: QroFooAgent
) {
  return [
    createResearchTool(
      leaveFooAgent,
      "research_leave_policy",
      "Research CAF leave policy questions. Use for annual leave, sick leave, special leave, parental leave, and other leave-related inquiries."
    ),
    createResearchTool(
      doadFooAgent,
      "research_doad_policy",
      "Research DOAD (Defence Administrative Orders and Directives) policy questions. Use for administrative policies, procedures, and directives."
    ),
    createResearchTool(
      qroFooAgent,
      "research_qro_policy",
      "Research QR&O (Queen's Regulations and Orders) policy questions. Use for military regulations, orders, and official procedures."
    ),
  ];
}
