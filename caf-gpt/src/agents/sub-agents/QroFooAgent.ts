/**
 * src/agents/sub-agents/QroFooAgent.ts
 *
 * Sub-agent for QR&O policy research using a two-call pattern
 *
 * Top-level declarations:
 * - QroFooAgent: Answers QR&O policy questions using two-call pattern (selector -> answer)
 */

import type { z } from "zod";
import type { AppConfig } from "../../config";
import { QroSelectorSchema } from "../../schemas";
import { TwoCallAgent } from "../utils/TwoCallAgent";

type QroSelectorResponse = z.infer<typeof QroSelectorSchema>;

export class QroFooAgent extends TwoCallAgent<QroSelectorResponse> {
  constructor(env: Env, config: AppConfig) {
    super(env, config, {
      category: "qro",
      policyType: "QR&O policy",
      modelKey: "qroFoo",
      selectorPromptName: "qro_foo_selector",
      answerPromptName: "qro_foo_answer",
    });
  }

  protected async selectFiles(query: string): Promise<string[]> {
    return this.runSelector(query);
  }

  protected getSelectorSchema(): z.ZodType<QroSelectorResponse> {
    return QroSelectorSchema;
  }

  protected extractFilesFromResponse(response: QroSelectorResponse): string[] {
    return response.qro_files;
  }

  protected getSelectorVariables(query: string, indexContent: string): Record<string, string> {
    return {
      qro_index: indexContent,
      user_input: query,
    };
  }

  protected async getIndexContent(): Promise<string | null> {
    return this.docRetriever.getDocument("qro", "index.md");
  }

  protected getFilePath(fileId: string): string {
    return fileId;
  }

  protected formatDocumentTag(fileId: string, content: string): string {
    const chapterName = fileId.split("/").pop()?.replace(".md", "") ?? fileId;
    // Sanitize chapter name for XML tag: replace non-alphanumeric chars (except hyphens) with underscores
    const sanitizedName = chapterName.replace(/[^a-zA-Z0-9-]/g, "_");
    return `<QRO_chapter_${sanitizedName}>\n${content}\n</QRO_chapter_${sanitizedName}>`;
  }
}
