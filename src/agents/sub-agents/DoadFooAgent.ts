/**
 * src/agents/sub-agents/DoadFooAgent.ts
 *
 * Sub-agent for DOAD policy research using Clef shortlist + document prefetch
 *
 * Top-level declarations:
 * - DoadFooAgent: Answers DOAD policy questions from Clef-prefetched documents
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
        documentsVariableName: "prefetched_documents",
        maxPrefetchDocuments: 3,
        formatDocumentTag: (id, content) => `<DOAD_${id}>\n${content}\n</DOAD_${id}>`,
      },
      dependencies
    );
  }
}
