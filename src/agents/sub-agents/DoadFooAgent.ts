/**
 * src/agents/sub-agents/DoadFooAgent.ts
 *
 * Sub-agent for DOAD policy research using a two-call pattern
 *
 * Top-level declarations:
 * - DoadFooAgent: Answers DOAD policy questions using two-call pattern (selector -> answer)
 */

import type { z } from "zod";
import type { AppConfig } from "../../config";
import { DoadSelectorSchema } from "../../schemas";
import { TwoCallAgent } from "../utils/TwoCallAgent";

type DoadSelectorResponse = z.infer<typeof DoadSelectorSchema>;

export class DoadFooAgent extends TwoCallAgent<DoadSelectorResponse> {
  constructor(env: Env, config: AppConfig) {
    super(env, config, {
      category: "doad",
      policyType: "DOAD policy",
      modelKey: "doadFoo",
      selectorPromptName: "doad_foo_selector",
      answerPromptName: "doad_foo_answer",
    });
  }

  protected async selectFiles(query: string): Promise<string[]> {
    return this.runSelector(query);
  }

  protected getSelectorSchema(): z.ZodType<DoadSelectorResponse> {
    return DoadSelectorSchema;
  }

  protected extractFilesFromResponse(response: DoadSelectorResponse): string[] {
    return response.doad_numbers;
  }

  protected getSelectorVariables(query: string, indexContent: string): Record<string, string> {
    return {
      doad_table: indexContent,
      user_input: query,
    };
  }

  protected async getIndexContent(): Promise<string | null> {
    return this.promptManager.getPrompt("DOAD_Table");
  }

  protected getFilePath(fileId: string): string {
    return `${fileId}.md`;
  }

  protected formatDocumentTag(fileId: string, content: string): string {
    return `<DOAD_${fileId}>\n${content}\n</DOAD_${fileId}>`;
  }
}
