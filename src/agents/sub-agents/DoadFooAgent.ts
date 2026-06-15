/**
 * src/agents/sub-agents/DoadFooAgent.ts
 *
 * Sub-agent for DOAD policy research using a bounded read_file tool
 *
 * Top-level declarations:
 * - DoadFooAgent: Answers DOAD policy questions using one tool-reading model call
 */

import type { AppConfig } from "../../config";
import { ToolReadingAgent } from "../utils/ToolReadingAgent";

const DOAD_ID_PATTERN = /^\|\s*(\d{4}-\d{1,2})\s*\|/gm;

export class DoadFooAgent extends ToolReadingAgent {
  constructor(env: Env, config: AppConfig) {
    super(env, config, {
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
    });
  }

  protected async getIndexContent(): Promise<string | null> {
    return this.promptManager.getPrompt("DOAD_Table");
  }

  protected getAllowedFiles(indexContent: string): Set<string> {
    return new Set(Array.from(indexContent.matchAll(DOAD_ID_PATTERN), (match) => match[1]));
  }

  protected getFilePath(file: string): string {
    return `${file}.md`;
  }

  protected formatDocumentTag(file: string, content: string): string {
    return `<DOAD_${file}>\n${content}\n</DOAD_${file}>`;
  }
}
