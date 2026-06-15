/**
 * src/agents/sub-agents/QroFooAgent.ts
 *
 * Sub-agent for QR&O policy research using a bounded read_file tool
 *
 * Top-level declarations:
 * - QroFooAgent: Answers QR&O policy questions using one tool-reading model call
 */

import type { AppConfig } from "../../config";
import { ToolReadingAgent } from "../utils/ToolReadingAgent";

const QRO_FILE_PATTERN = /(?:^|\s)([\w/-]+\.md)(?=\s|$)/gm;

export class QroFooAgent extends ToolReadingAgent {
  constructor(env: Env, config: AppConfig) {
    super(env, config, {
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
    });
  }

  protected async getIndexContent(): Promise<string | null> {
    return this.docRetriever.getDocument("qro", "index.md");
  }

  protected getAllowedFiles(indexContent: string): Set<string> {
    return new Set(Array.from(indexContent.matchAll(QRO_FILE_PATTERN), (match) => match[1]));
  }

  protected getFilePath(file: string): string {
    return file;
  }

  protected formatDocumentTag(file: string, content: string): string {
    const chapterName = file.split("/").pop()?.replace(".md", "") ?? file;
    // Sanitize chapter name for XML tag: replace non-alphanumeric chars (except hyphens) with underscores
    const sanitizedName = chapterName.replace(/[^a-zA-Z0-9-]/g, "_");
    return `<QRO_chapter_${sanitizedName}>\n${content}\n</QRO_chapter_${sanitizedName}>`;
  }
}
