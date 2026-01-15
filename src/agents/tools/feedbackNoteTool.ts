/**
 * src/agents/tools/feedbackNoteTool.ts
 *
 * LangChain tool for generating CAF PACE feedback notes
 *
 * Top-level declarations:
 * - createFeedbackNoteTool: Creates feedback note generation tool from PaceFooAgent
 */

import { tool } from "langchain";
import { z } from "zod";
import type { PaceFooAgent } from "../sub-agents";

// Creates LangChain tool for generating CAF PACE feedback notes
export function createFeedbackNoteTool(paceFooAgent: PaceFooAgent) {
  return tool(
    async ({ rank, context }) => {
      return await paceFooAgent.generateNote(rank, context);
    },
    {
      name: "generate_feedback_note",
      description:
        "Generate a CAF PACE feedback note for a member. Use when someone requests a feedback note, PER input, or performance documentation.",
      schema: z.object({
        rank: z
          .enum(["cpl", "mcpl", "sgt", "wo"])
          .describe("CAF rank of the member (cpl, mcpl, sgt, or wo)"),
        context: z
          .string()
          .describe(
            "Detailed description of events, actions, and performance to document in the feedback note"
          ),
      }),
    }
  );
}
