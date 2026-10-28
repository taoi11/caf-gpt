/**
 * src/agents/sub-agents/DoadFooAgent.ts
 *
 * Sub-agent for DOAD policy research using Clef shortlist + document prefetch
 *
 * Top-level declarations:
 * - doadSeriesGroup: Stage-1 shortlist group of a DOAD manifest row (its thousand series)
 * - DoadFooAgent: Answers DOAD policy questions from Clef-prefetched documents
 */

import type { AppConfig } from "../../config";
import type { ManifestGroup } from "../utils/ClefDecision";
import type { ManifestRow } from "../utils/ManifestParser";
import { ToolReadingAgent, type ToolReadingAgentDependencies } from "../utils/ToolReadingAgent";

/** Leading digit of a numbered DAOD id such as 5019-0 (5000 series). */
const DOAD_SERIES_PATTERN = /^(\d)\d{3}-/;

/**
 * Groups a DOAD manifest row by its DAOD series (1000, 2000, ... from the id's leading digit);
 * ids that are not numbered DAODs share one group.
 * @param row - Allowlisted DOAD manifest row
 */
export function doadSeriesGroup(row: ManifestRow): ManifestGroup {
  const match = DOAD_SERIES_PATTERN.exec(row.id);
  if (match === null) {
    return { key: "", label: "DAOD documents outside a numbered series" };
  }
  const series = `${match[1]}000`;
  return { key: series, label: `DAOD ${series} series` };
}

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
        groupOf: doadSeriesGroup,
        formatDocumentTag: (id, content) => `<DOAD_${id}>\n${content}\n</DOAD_${id}>`,
      },
      dependencies
    );
  }
}
