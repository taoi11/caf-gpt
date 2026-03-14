/**
 * src/agents/tools/feedbackNoteTool.ts
 *
 * AI SDK tool for generating CAF PACE feedback notes
 *
 * Top-level declarations:
 * - createFeedbackNoteTool: Creates feedback note generation tool from PaceFooAgent
 */

import { tool } from "ai";
import { z } from "zod";
import type { PaceFooAgent } from "../sub-agents";

export function createFeedbackNoteTool(paceFooAgent: PaceFooAgent) {
  const aiTool = tool({
    description:
      "Generate a CAF PACE feedback note for a member. Use when someone requests a feedback note, PER input, or performance documentation.",
    inputSchema: z.object({
      rank: z.enum(["cpl", "mcpl", "sgt", "wo"]),
      context: z.string(),
    }),
    execute: async ({ rank, context }) => paceFooAgent.generateNote(rank, context),
  });

  return Object.assign(aiTool, {
    invoke: async (
      input: { rank: "cpl" | "mcpl" | "sgt" | "wo"; context: string },
      context?: unknown
    ) => {
      if (!aiTool.execute) throw new Error("Tool execute function missing");
      return aiTool.execute(input, context as any);
    },
  });
}
