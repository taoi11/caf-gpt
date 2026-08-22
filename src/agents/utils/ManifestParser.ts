/**
 * src/agents/utils/ManifestParser.ts
 *
 * Shared parser for policy index markdown tables in `| Id | Title | File |` shape
 *
 * Top-level declarations:
 * - parseManifestTable: Extracts an Id-to-File map from a markdown table
 * - isSafeId: Validates a relative file identifier without traversal or absolute paths
 * - isSafeFilePath: Validates a relative file identifier that ends with .md
 */

const SEPARATOR_CELL_PATTERN = /^:?-{3,}:?$/;
const SAFE_SEGMENT_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
const WINDOWS_DRIVE_PATTERN = /^[a-zA-Z]:[\\/]/;

// Validate one manifest identifier, rejecting absolute paths, traversal, and empty segments.
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

// Validate one manifest File value: a safe relative identifier ending in .md.
export function isSafeFilePath(value: string): boolean {
  return value.endsWith(".md") && isSafeId(value);
}

// Parse a `| Id | Title | File |` markdown table into an Id-to-File map. Invalid rows are skipped silently.
export function parseManifestTable(markdown: string): Map<string, string> {
  const manifest = new Map<string, string>();

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith("|") || !line.endsWith("|")) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length !== 3 || cells.every((cell) => SEPARATOR_CELL_PATTERN.test(cell))) continue;
    if (isSafeId(cells[0]) && isSafeFilePath(cells[2])) manifest.set(cells[0], cells[2]);
  }

  return manifest;
}
