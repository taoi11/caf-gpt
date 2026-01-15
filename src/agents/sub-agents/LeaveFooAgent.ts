/**
 * src/agents/sub-agents/LeaveFooAgent.ts
 *
 * Sub-agent for leave policy research using R2 document retrieval and AI
 *
 * Top-level declarations:
 * - LeaveFooAgent: Answers leave policy questions using R2 documents and AI
 * - research: Processes research requests for leave policy questions
 */

import { StorageNotFoundError } from "../../errors";
import type { ResearchRequest } from "../../types";
import { BaseAgent } from "../utils/BaseAgent";

export class LeaveFooAgent extends BaseAgent {
  async research(request: ResearchRequest): Promise<string> {
    const startTime = Date.now();

    try {
      this.logger.info("Starting leave_foo research");

      if (!request.question || request.question.trim().length === 0) {
        throw new Error("Empty research question provided");
      }

      const leavePolicy = await this.docRetriever.getDocument("leave", "leave_policy_2025.md");

      const response = await this.callLangChain({
        model: this.config.llm.models.leaveFoo.model,
        promptName: "leave_foo_research",
        variables: {
          leave_policy: leavePolicy,
          user_input: request.question,
        },
        temperature: this.config.llm.models.leaveFoo.temperature,
      });

      this.logger.performance("leave_foo research", startTime, {
        question: request.question?.substring(0, 100),
      });

      return response;
    } catch (error) {
      // Handle storage errors gracefully
      if (error instanceof StorageNotFoundError) {
        this.logger.warn("Leave policy document not found");
        return "I apologize, but I cannot access the leave policy document at this time.";
      }

      return this.handleResearchError("leave_foo research", startTime, error, "leave policy", {
        question: request.question?.substring(0, 100),
      });
    }
  }
}
