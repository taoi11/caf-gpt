/**
 * src/agents/utils/ManifestParser.ts
 *
 * Shared parser for policy index markdown tables in `| Id | Title | File |` shape
 *
 * Top-level declarations:
 * - ManifestRow: One validated index row (id, title, file)
 * - parseManifestRows: Extracts ordered Id/Title/File rows from a markdown table
 * - parseManifestTable: Extracts an Id-to-File map from a markdown table
 * - isSafeId: Validates a relative file identifier without traversal or absolute paths
 * - isSafeFilePath: Validates a relative file identifier that ends with .md
 */

const SEPARATOR_CELL_PATTERN = /^:?-{3,}:?$/;
const SAFE_SEGMENT_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
const WINDOWS_DRIVE_PATTERN = /^[a-zA-Z]:[\\/]/;

/** One validated `| Id | Title | File |` row from a policy index. */
export interface ManifestRow {
  id: string;
  title: string;
  file: string;
}

/** Validate one manifest identifier, rejecting absolute paths, traversal, and empty segments. */
export function isSafeId(value: string): boolean {
  if (
    value.length === 0 ||
    value !== value.trim() ||
    value.includes("\\") ||
    value.startsWith("/") ||
    WINDOWS_DRIVE_PATTERN.test(value)
  ) {
    return false;
  }
  return value
    .split("/")
    .every(
      (segment) =>
        segment.length > 0 &&
        segment !== "." &&
        segment !== ".." &&
        SAFE_SEGMENT_PATTERN.test(segment)
    );
}

/** Validate one manifest File value: a safe relative identifier ending in .md. */
export function isSafeFilePath(value: string): boolean {
  return value.endsWith(".md") && isSafeId(value);
}

/**
 * Parse a `| Id | Title | File |` markdown table into ordered rows.
 * Invalid rows are skipped silently.
 * @param markdown - Index markdown that may include prose around the table
 */
export function parseManifestRows(markdown: string): ManifestRow[] {
  const rows: ManifestRow[] = [];

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith("|") || !line.endsWith("|")) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length !== 3 || cells.every((cell) => SEPARATOR_CELL_PATTERN.test(cell))) continue;
    if (!isSafeId(cells[0]) || !isSafeFilePath(cells[2])) continue;
    rows.push({ id: cells[0], title: cells[1], file: cells[2] });
  }

  return rows;
}

/** Parse a `| Id | Title | File |` markdown table into an Id-to-File map. Invalid rows are skipped silently. */
export function parseManifestTable(markdown: string): Map<string, string> {
  const manifest = new Map<string, string>();
  for (const row of parseManifestRows(markdown)) {
    manifest.set(row.id, row.file);
  }
  return manifest;
}
