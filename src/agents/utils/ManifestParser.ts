/**
 * src/agents/utils/ManifestParser.ts
 *
 * Shared parser for policy index markdown tables in `| Id | Title | File |` shape
 *
 * Top-level declarations:
 * - ManifestRow: One validated index row (id, title, file)
 * - ManifestIndex: Parsed rows plus the count of dropped table rows
 * - parseManifestIndex: Extracts ordered rows and counts malformed or unsafe table rows
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

/** Parsed policy index: allowlisted rows plus the count of table rows that failed validation. */
export interface ManifestIndex {
  rows: ManifestRow[];
  /** Table body rows dropped as malformed or unsafe (header and separator rows are not counted). */
  skippedRows: number;
}

/** Header cells of the shared policy index table, compared case-insensitively. */
const HEADER_CELLS = ["id", "title", "file"] as const;

/**
 * Whether a table row is the `| Id | Title | File |` header.
 * @param cells - Trimmed cells of one table row
 */
function isHeaderRow(cells: string[]): boolean {
  return (
    cells.length === HEADER_CELLS.length &&
    cells.every((cell, index) => cell.toLowerCase() === HEADER_CELLS[index])
  );
}

/**
 * Parse a `| Id | Title | File |` markdown table into ordered rows and count the table rows that
 * were dropped (wrong column count, unsafe Id, or a File that is not a safe relative .md path), so
 * callers can log the count and fail loudly when nothing usable remains.
 * @param markdown - Index markdown that may include prose around the table
 */
export function parseManifestIndex(markdown: string): ManifestIndex {
  const rows: ManifestRow[] = [];
  let skippedRows = 0;

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line.startsWith("|") || !line.endsWith("|")) continue;

    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());

    if (cells.every((cell) => SEPARATOR_CELL_PATTERN.test(cell)) || isHeaderRow(cells)) continue;

    if (cells.length !== 3 || !isSafeId(cells[0]) || !isSafeFilePath(cells[2])) {
      skippedRows += 1;
      continue;
    }

    rows.push({ id: cells[0], title: cells[1], file: cells[2] });
  }

  return { rows, skippedRows };
}

/**
 * Parse a `| Id | Title | File |` markdown table into ordered rows.
 * Invalid rows are dropped; use parseManifestIndex when the dropped-row count matters.
 * @param markdown - Index markdown that may include prose around the table
 */
export function parseManifestRows(markdown: string): ManifestRow[] {
  return parseManifestIndex(markdown).rows;
}

/** Parse a `| Id | Title | File |` markdown table into an Id-to-File map. Invalid rows are skipped silently. */
export function parseManifestTable(markdown: string): Map<string, string> {
  const manifest = new Map<string, string>();

  for (const row of parseManifestRows(markdown)) {
    manifest.set(row.id, row.file);
  }

  return manifest;
}
