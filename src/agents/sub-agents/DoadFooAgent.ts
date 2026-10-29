/**
 * src/agents/sub-agents/DoadFooAgent.ts
 *
 * Sub-agent for DOAD policy research using a bounded read_file tool over the DOAD table
 *
 * Top-level declarations:
 * - DoadFooAgent: Answers DOAD policy questions using one tool-reading model call
 */

import type { AppConfig } from "../../config";
import { ToolReadingAgent, type ToolReadingAgentDependencies } from "../utils/ToolReadingAgent";

export class DoadFooAgent extends ToolReadingAgent {
  constructor(env: Env, config: AppConfig, dependencies: ToolReadingAgentDependencies = {}) {
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
        formatDocumentTag: (id, content) => `<DOAD_${id}>\n${content}\n</DOAD_${id}>`,
      },
      dependencies
    );
  }
}
