/**
 * src/agents/sub-agents/PaceFooAgent.ts
 *
 * Sub-agent for generating feedback notes based on rank competencies
 *
 * Top-level declarations:
 * - PaceFooAgent: Generates feedback notes for CAF members using rank-specific competencies
 * - generateNote: Generates a feedback note based on rank and context
 */

import { getSafeErrorMetadata } from "../../Logger";
import { BaseAgent } from "../utils/BaseAgent";

const VALID_RANKS = new Set(["cpl", "mcpl", "sgt", "wo"]);

export class PaceFooAgent extends BaseAgent {
  /**
   * Generates a feedback note based on rank and context.
   * Orchestrates validation, document retrieval, and AI generation.
   */
  async generateNote(rank: string, context: string): Promise<string> {
    const startTime = Date.now();

    try {
      this.logger.info("Starting pacenote generation");

      this.validateContext(context);

      const { competencies, examples, effectiveRank } = await this.fetchRequiredDocuments(rank);

      const response = await this.executeGeneration(effectiveRank, context, competencies, examples);

      this.logger.performance("pacenote generation", startTime, {
        contextLength: context.length,
      });

      return response;
    } catch (error) {
      this.logger.error("pacenote generation failed", {
        processingTime: Date.now() - startTime,
        contextLength: context.length,
        ...getSafeErrorMetadata(error),
      });
      throw error;
    }
  }

  /**
   * Validates that the provided context is not empty.
   */
  private validateContext(context: string): void {
    if (!context || context.trim().length === 0) {
      throw new Error("Empty context provided");
    }
  }

  /**
   * Fetches rank-specific competencies and feedback examples concurrently from R2 storage.
   * Returns the validated normalized rank alongside both required documents.
   */
  private async fetchRequiredDocuments(
    rank: string
  ): Promise<{ competencies: string; examples: string; effectiveRank: string }> {
    const rankLower = rank.toLowerCase();
    if (!VALID_RANKS.has(rankLower)) {
      throw new Error("Unknown rank provided");
    }
    const effectiveRank = rankLower;

    const [competencies, examples] = await Promise.all([
      this.docRetriever.getDocument("paceNote", `${effectiveRank}.md`),
      this.docRetriever.getDocument("paceNote", "examples.md"),
    ]);

    return { competencies, examples, effectiveRank };
  }

  /**
   * Executes the LLM call to generate the feedback note.
   */
  private async executeGeneration(
    effectiveRank: string,
    context: string,
    competencies: string,
    examples: string
  ): Promise<string> {
    return await this.callLangChain({
      model: this.config.llm.models.paceFoo.model,
      promptName: "pace_foo_research",
      variables: {
        rank: effectiveRank.toUpperCase(),
        competencies,
        examples,
        user_input: context,
      },
      temperature: this.config.llm.models.paceFoo.temperature,
      maxOutputTokens: this.config.llm.models.paceFoo.maxOutputTokens,
    });
  }
}
