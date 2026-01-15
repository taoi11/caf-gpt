/**
 * src/agents/sub-agents/PaceFooAgent.ts
 *
 * Sub-agent for generating feedback notes based on rank competencies
 *
 * Top-level declarations:
 * - PaceFooAgent: Generates feedback notes for CAF members using rank-specific competencies
 * - generateNote: Generates a feedback note based on rank and context
 */

import { StorageNotFoundError } from "../../errors";
import { BaseAgent } from "../utils/BaseAgent";

const VALID_RANKS = new Set(["cpl", "mcpl", "sgt", "wo"]);

export class PaceFooAgent extends BaseAgent {
  async generateNote(rank: string, context: string): Promise<string> {
    const startTime = Date.now();

    try {
      this.logger.info("Starting pacenote generation", { rank });

      if (!context || context.trim().length === 0) {
        throw new Error("Empty context provided");
      }

      const rankLower = rank.toLowerCase();
      const isValidRank = VALID_RANKS.has(rankLower);

      if (!isValidRank) {
        this.logger.warn("Unknown rank, defaulting to CPL", {
          providedRank: rank,
          defaultRank: "cpl",
        });
      }

      const selectedRankFile = isValidRank ? `${rankLower}.md` : "cpl.md";

      const competencies = await this.docRetriever.getDocument("paceNote", selectedRankFile);
      const examples = await this.docRetriever.getDocument("paceNote", "examples.md");

      const response = await this.callLangChain({
        model: this.config.llm.models.paceFoo.model,
        promptName: "pace_foo_research",
        variables: {
          rank: rank.toUpperCase(),
          competencies,
          examples,
          user_input: context,
        },
        temperature: this.config.llm.models.paceFoo.temperature,
      });

      this.logger.performance("pacenote generation", startTime, {
        rank,
        contextLength: context.length,
      });

      return response;
    } catch (error) {
      // Handle storage errors gracefully
      if (error instanceof StorageNotFoundError) {
        this.logger.warn("Required document not found", { rank, error: error.message });
        return "I'm sorry, but I couldn't generate the feedback note at this time.";
      }

      return this.handleAgentError(
        "pacenote generation",
        startTime,
        error,
        {
          timeout: "I encountered a timeout while generating the feedback note.",
          aiGateway:
            "I encountered an issue with the AI service while generating the feedback note.",
          generic: "I'm sorry, but I couldn't generate the feedback note at this time.",
        },
        { rank, contextLength: context.length }
      );
    }
  }
}
