/**
 * src/agents/sub-agents/QroFooAgent.ts
 *
 * Sub-agent for QR&O policy research using a bounded read_file tool over the QR&O index
 *
 * Top-level declarations:
 * - QroFooAgent: Answers QR&O policy questions using one tool-reading model call
 */

import type { AppConfig } from "../../config";
import { ToolReadingAgent, type ToolReadingAgentDependencies } from "../utils/ToolReadingAgent";

export class QroFooAgent extends ToolReadingAgent {
  constructor(env: Env, config: AppConfig, dependencies: ToolReadingAgentDependencies = {}) {
    super(
      env,
      config,
      {
        category: "qro",
        policyType: "QR&O policy",
        modelKey: "qroFoo",
        promptName: "qro_foo_tool_reader",
        indexVariableName: "qro_index",
        readLimits: {
          totalCalls: 5,
          successfulReads: 3,
          badCalls: 2,
        },
        formatDocumentTag: (id, content) => {
          const chapterName = id.split("/").pop()?.replace(".md", "") ?? id;
          // Sanitize chapter name for XML tag: replace non-alphanumeric chars (except hyphens) with underscores
          const sanitizedName = chapterName.replace(/[^a-zA-Z0-9-]/g, "_");

          return `<QRO_chapter_${sanitizedName}>\n${content}\n</QRO_chapter_${sanitizedName}>`;
        },
      },
      dependencies
    );
  }
}
