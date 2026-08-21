/**
 * tests/unit/ManifestParser.test.ts
 *
 * Unit tests for ManifestParser - shared policy index markdown table parser
 */

import { describe, expect, it } from "vitest";
import {
  isSafeFilePath,
  isSafeId,
  parseManifestTable,
} from "../../src/agents/utils/ManifestParser";

describe("parseManifestTable", () => {
  it("should parse valid 3-column rows to an Id-to-File map", () => {
    const manifest = parseManifestTable(`| Id | Title | File |
|---|---|---|
| 5019-0 | Conduct and Performance Deficiencies | 5019-0.md |
| vol-1-administration/ch-16-leave.md | Leave Regulations | vol-1-administration/ch-16-leave.md |`);
    expect([...manifest.entries()]).toEqual([
      ["5019-0", "5019-0.md"],
      ["vol-1-administration/ch-16-leave.md", "vol-1-administration/ch-16-leave.md"],
    ]);
  });

  it("should skip header, separator, prose, heading, and list lines", () => {
    const manifest = parseManifestTable(`# DOAD Index

| DOAD Number | Title |
|-------------|-------|

| Id | Title | File |
|---|---|---|
| 5019-0 | Conduct | 5019-0.md |

For background, read vol-9-misleading/ch-99-not-an-entry.md before continuing.
- vol-1-administration/ch-16-leave.md — Leave Regulations
1. This mentions vol-8-misleading/ch-88-not-an-entry.md in prose.

| 5031-1 | Grievance | 5031-1.md |`);
    expect([...manifest.keys()]).toEqual(["5019-0", "5031-1"]);
  });

  it("should ignore rows without exactly three columns", () => {
    const manifest = parseManifestTable(`| Id | Title | File |
|---|---|---|
| 5019-0 | Conduct | 5019-0.md |
| 6000-1 | Only two cells |
| 6000-2 | One | extra | cell |`);
    expect([...manifest.keys()]).toEqual(["5019-0"]);
  });

  it("should reject rows with unsafe Id values", () => {
    const manifest = parseManifestTable(`| Id | Title | File |
|---|---|---|
| 5019-0\\\\bad | Backslash id | 5019-0.md |
| ./rel.md | Leading dot | rel.md |
| ../rel.md | Traversal | rel.md |
| /abs.md | Absolute | abs.md |
| vol-1//a.md | Empty segment | vol-1/a.md |
| vol-1/./a.md | Dot segment | vol-1/a.md |
| good-1 | Valid | good-1.md |`);
    expect([...manifest.keys()]).toEqual(["good-1"]);
  });

  it("should reject rows with unsafe File values", () => {
    const manifest = parseManifestTable(`| Id | Title | File |
|---|---|---|
| 1-1 | No extension | 1-1 |
| 2-1 | Backslash | 2\\\\1.md |
| 3-1 | Traversal | 3/../1.md |
| 4-1 | Absolute | /4-1.md |
| 5-1 | Empty segment | 5//1.md |
| 6-1 | Valid | 6-1.md |`);
    expect([...manifest.keys()]).toEqual(["6-1"]);
  });

  it("should handle CRLF line endings", () => {
    const manifest = parseManifestTable(
      "| Id | Title | File |\r\n|---|---|---|\r\n| 5019-0 | Conduct | 5019-0.md |\r\n"
    );
    expect(manifest.get("5019-0")).toBe("5019-0.md");
  });

  it("should return an empty map for empty input", () => {
    expect(parseManifestTable("").size).toBe(0);
    expect(parseManifestTable("\n\n  \n").size).toBe(0);
  });
});

describe("isSafeId / isSafeFilePath", () => {
  it("should accept bare DOAD ids and relative paths", () => {
    expect(isSafeId("5019-0")).toBe(true);
    expect(isSafeId("vol-1-administration/ch-16-leave.md")).toBe(true);
  });

  it("should reject unsafe relative identifiers", () => {
    expect(isSafeId("../x")).toBe(false);
    expect(isSafeId("/abs/x.md")).toBe(false);
    expect(isSafeId("a//b")).toBe(false);
    expect(isSafeId("a/./b")).toBe(false);
    expect(isSafeId("C:/win")).toBe(false);
    expect(isSafeId("a\\\\b")).toBe(false);
  });

  it("should require a .md suffix on file paths only", () => {
    expect(isSafeFilePath("5019-0.md")).toBe(true);
    expect(isSafeFilePath("5019-0")).toBe(false);
    expect(isSafeId("5019-0")).toBe(true);
  });
});
