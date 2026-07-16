/**
 * src/agents/sub-agents/QroFooAgent.ts
 *
 * Sub-agent for QR&O policy research using a bounded read_file tool
 *
 * Top-level declarations:
 * - QroFooAgent: Answers QR&O policy questions using one tool-reading model call
 * - normalizeQroFilePath: Validates and normalizes a relative QR&O Markdown path
 * - getQroIndexEntryPath: Extracts a path from a Markdown list or table entry
 */

import type { AppConfig } from "../../config";
import { ToolReadingAgent } from "../utils/ToolReadingAgent";

const MARKDOWN_LIST_ENTRY_PATTERN = /^(?:[-+*]|\d+[.)])\s+(.+)$/;
const MARKDOWN_LINK_PATTERN = /^\[[^\]]+\]\(([^()\s]+)\)$/;
const SAFE_PATH_SEGMENT_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

// Validate and normalize one relative QR&O Markdown document path.
function normalizeQroFilePath(value: string): string | null {
  let path = value.trim();
  const markdownLink = path.match(MARKDOWN_LINK_PATTERN);
  if (markdownLink) {
    path = markdownLink[1];
  } else if (
    (path.startsWith("`") && path.endsWith("`")) ||
    (path.startsWith("<") && path.endsWith(">"))
  ) {
    path = path.slice(1, -1).trim();
  }

  if (
    !path.endsWith(".md") ||
    path.startsWith("/") ||
    /^[a-zA-Z]:[\\/]/.test(path) ||
    path.includes("\\")
  ) {
    return null;
  }

  const segments = path.split("/");
  if (
    segments.some(
      (segment) =>
        segment.length === 0 ||
        segment === "." ||
        segment === ".." ||
        !SAFE_PATH_SEGMENT_PATTERN.test(segment)
    )
  ) {
    return null;
  }

  return segments.join("/");
}

// Extract a safe path from one Markdown list item or standalone table cell.
function getQroIndexEntryPath(value: string, allowDescription: boolean): string | null {
  const trimmed = value.trim();
  if (!allowDescription) {
    return normalizeQroFilePath(trimmed);
  }

  const markdownLink = trimmed.match(/^(\[[^\]]+\]\([^()\s]+\))(?:\s|$)/);
  const codePath = trimmed.match(/^(`[^`]+`)(?:\s|$)/);
  const autolinkPath = trimmed.match(/^(<[^<>]+>)(?:\s|$)/);
  const plainPath = trimmed.match(/^(\S+)/);
  const candidate = markdownLink?.[1] ?? codePath?.[1] ?? autolinkPath?.[1] ?? plainPath?.[1];

  return candidate ? normalizeQroFilePath(candidate) : null;
}

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
    const allowedFiles = new Set<string>();

    for (const line of indexContent.split(/\r?\n/)) {
      const trimmed = line.trim();
      const listEntry = trimmed.match(MARKDOWN_LIST_ENTRY_PATTERN);
      if (listEntry) {
        const path = getQroIndexEntryPath(listEntry[1], true);
        if (path) allowedFiles.add(path);
        continue;
      }

      if (trimmed.startsWith("|") || trimmed.endsWith("|")) {
        for (const cell of trimmed.split("|")) {
          const path = getQroIndexEntryPath(cell, false);
          if (path) allowedFiles.add(path);
        }
      }
    }

    return allowedFiles;
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
