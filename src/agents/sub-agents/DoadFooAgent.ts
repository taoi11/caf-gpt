/**
 * src/agents/sub-agents/DoadFooAgent.ts
 *
 * Sub-agent for DOAD policy research using a bounded read_file tool
 *
 * Top-level declarations:
 * - DoadFooAgent: Answers DOAD policy questions using one tool-reading model call
 */

import type { AppConfig } from "../../config";
import type { BaseAgentDependencies } from "../utils/BaseAgent";
import { ToolReadingAgent } from "../utils/ToolReadingAgent";

export class DoadFooAgent extends ToolReadingAgent {
  constructor(env: Env, config: AppConfig, dependencies: Partial<BaseAgentDependencies> = {}) {
    super(
      env,
      config,
      {
        category: "doad",
        policyType: "DOAD policy",
        modelKey: "doadFoo",
        promptName: "doad_foo_tool_reader",
        indexVariableName: "doad_table",
        readLimits: {
          totalCalls: 5,
          successfulReads: 3,
          badCalls: 2,
        },
      },
      dependencies
    );
  }

  protected async getIndexContent(): Promise<string | null> {
    return this.promptManager.getPrompt("DOAD_Table");
  }

  protected formatDocumentTag(file: string, content: string): string {
    return `<DOAD_${file}>\n${content}\n</DOAD_${file}>`;
  }
}
