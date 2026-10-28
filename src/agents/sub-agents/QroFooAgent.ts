/**
 * src/agents/sub-agents/QroFooAgent.ts
 *
 * Sub-agent for QR&O policy research using Clef shortlist + document prefetch
 *
 * Top-level declarations:
 * - qroVolumeGroup: Stage-1 shortlist group of a QR&O manifest row (its volume folder)
 * - QroFooAgent: Answers QR&O policy questions from Clef-prefetched documents
 */

import type { AppConfig } from "../../config";
import type { ManifestGroup } from "../utils/ClefDecision";
import type { ManifestRow } from "../utils/ManifestParser";
import { ToolReadingAgent, type ToolReadingAgentDependencies } from "../utils/ToolReadingAgent";

/**
 * Groups a QR&O manifest row by its volume folder (first id segment, e.g. vol-1-administration);
 * rows without a folder share one group.
 * @param row - Allowlisted QR&O manifest row
 */
export function qroVolumeGroup(row: ManifestRow): ManifestGroup {
  const slash = row.id.indexOf("/");

  if (slash < 0) {
    return { key: "", label: "QR&O documents outside a volume" };
  }

  const volume = row.id.slice(0, slash);

  return { key: volume, label: `QR&O ${volume.replaceAll("-", " ")}` };
}

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
        documentsVariableName: "prefetched_documents",
        maxPrefetchDocuments: 3,
        groupOf: qroVolumeGroup,
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
