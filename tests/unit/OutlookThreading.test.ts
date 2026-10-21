/**
 * tests/unit/OutlookThreading.test.ts
 *
 * Unit tests for Outlook/Exchange Thread-Index and Thread-Topic reply headers
 *
 * Top-level declarations:
 * - buildParentIndex: Builds a 22-byte conversation index header for a given time
 * - buildChildThreadIndex suite: Verifies MS-OXOMSG response-level encoding and rejection rules
 * - buildOutlookThreadHeaders suite: Verifies header selection and topic fallback
 */

import { describe, expect, it } from "vitest";
import {
  buildChildThreadIndex,
  buildOutlookThreadHeaders,
} from "../../src/email/utils/OutlookThreading";

const FILETIME_UNIX_EPOCH_OFFSET = 116444736000000000n;
const PARENT_MS = Date.UTC(2026, 9, 21, 21, 0, 0);
const GUID = Array.from({ length: 16 }, (_, index) => index + 1);

/**
 * Builds a 22-byte conversation index header (0x01, 5-byte FILETIME, GUID) as base64. The
 * current layout stores FILETIME bits 24-63; the legacy Outlook 2007-2019 layout bits 16-55.
 */
function buildParentIndex(ms: number, extraBytes: number[] = [], legacy = false): string {
  const filetime = BigInt(ms) * 10000n + FILETIME_UNIX_EPOCH_OFFSET;
  const lowShift = legacy ? 16 : 24;
  const time = Array.from({ length: 5 }, (_, index) =>
    Number((filetime >> BigInt(lowShift + 32 - index * 8)) & 0xffn)
  );
  return btoa(String.fromCharCode(0x01, ...time, ...GUID, ...extraBytes));
}

/** Decodes base64 to a byte array; a missing value decodes to no bytes. */
function decode(value: string | undefined): number[] {
  return Array.from(atob(value ?? ""), (character) => character.charCodeAt(0));
}

/** Header FILETIME of a parent index, with the excluded 24 low bits zeroed. */
function headerFiletime(parent: string): bigint {
  const bytes = decode(parent);
  let time = 0n;
  for (let index = 1; index <= 5; index++) time = (time << 8n) | BigInt(bytes[index]);
  return time << 24n;
}

describe("buildChildThreadIndex", () => {
  it("appends one 5-byte response level with a short time delta and the random byte", () => {
    const parent = buildParentIndex(PARENT_MS);
    const nowMs = PARENT_MS + 60 * 60 * 1000;
    const child = buildChildThreadIndex(parent, nowMs, 0xab);

    expect(child).toBeDefined();
    const bytes = decode(child);
    expect(bytes).toHaveLength(27);
    expect(bytes.slice(0, 22)).toEqual(decode(parent));

    const diff = BigInt(nowMs) * 10000n + FILETIME_UNIX_EPOCH_OFFSET - headerFiletime(parent);
    const expected = Number((diff >> 18n) & 0x7fffffffn);
    const level = ((bytes[22] << 24) | (bytes[23] << 16) | (bytes[24] << 8) | bytes[25]) >>> 0;
    expect(level >>> 31).toBe(0);
    expect(level).toBe(expected);
    expect(bytes[26]).toBe(0xab);
  });

  it("uses the long delta code when the parent is older than about 1.7 years", () => {
    const parent = buildParentIndex(PARENT_MS);
    const nowMs = PARENT_MS + 3 * 365 * 24 * 60 * 60 * 1000;
    const bytes = decode(buildChildThreadIndex(parent, nowMs, 0));
    const diff = BigInt(nowMs) * 10000n + FILETIME_UNIX_EPOCH_OFFSET - headerFiletime(parent);
    const level = ((bytes[22] << 24) | (bytes[23] << 16) | (bytes[24] << 8) | bytes[25]) >>> 0;

    expect(level >>> 31).toBe(1);
    expect(level & 0x7fffffff).toBe(Number((diff >> 23n) & 0x7fffffffn));
  });

  it("extends a parent that already has response levels and clamps clock skew to zero", () => {
    const parent = buildParentIndex(PARENT_MS, [1, 2, 3, 4, 5]);
    const bytes = decode(buildChildThreadIndex(parent, PARENT_MS - 60_000, 7));

    expect(bytes).toHaveLength(32);
    expect(bytes.slice(0, 27)).toEqual(decode(parent));
    expect(bytes.slice(27)).toEqual([0, 0, 0, 0, 7]);
  });

  it("reconstructs the legacy Outlook 2007-2019 header time instead of clamping to zero", () => {
    const parent = buildParentIndex(PARENT_MS, [], true);
    const nowMs = PARENT_MS + 60 * 60 * 1000;
    const bytes = decode(buildChildThreadIndex(parent, nowMs, 0));
    const level = ((bytes[22] << 24) | (bytes[23] << 16) | (bytes[24] << 8) | bytes[25]) >>> 0;
    const filetime = BigInt(PARENT_MS) * 10000n + FILETIME_UNIX_EPOCH_OFFSET;
    const legacyHeaderTime = (filetime >> 16n) << 16n;
    const now = BigInt(nowMs) * 10000n + FILETIME_UNIX_EPOCH_OFFSET;

    expect(level >>> 31).toBe(0);
    expect(level).toBe(Number(((now - legacyHeaderTime) >> 18n) & 0x7fffffffn));
  });

  it("ignores whitespace left by header folding", () => {
    const parent = buildParentIndex(PARENT_MS, [1, 2, 3, 4, 5]);
    const folded = `${parent.slice(0, 20)}\r\n ${parent.slice(20)}`;
    const bytes = decode(buildChildThreadIndex(folded, PARENT_MS, 9));

    expect(bytes.slice(0, 27)).toEqual(decode(parent));
    expect(bytes).toHaveLength(32);
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["not base64", "not*base64!"],
    ["too short", btoa(String.fromCharCode(0x01, 1, 2, 3))],
    ["partial response level", buildParentIndex(PARENT_MS, [1, 2])],
    [
      "wrong reserved byte",
      btoa(String.fromCharCode(0x02, ...Array.from({ length: 21 }, () => 0))),
    ],
    [
      "over the length cap",
      buildParentIndex(
        PARENT_MS,
        Array.from({ length: 5 * 140 }, () => 0)
      ),
    ],
  ])("returns undefined for a %s parent", (_label, parent) => {
    expect(buildChildThreadIndex(parent, PARENT_MS, 0)).toBeUndefined();
  });
});

describe("buildOutlookThreadHeaders", () => {
  it("sets a child Thread-Index and reuses the inbound Thread-Topic", () => {
    const parent = buildParentIndex(PARENT_MS);
    const headers = buildOutlookThreadHeaders(
      { "thread-index": parent, "thread-topic": "feedback note please" },
      "RE: feedback note please",
      PARENT_MS + 1000
    );

    expect(decode(headers["Thread-Index"]).slice(0, 22)).toEqual(decode(parent));
    expect(decode(headers["Thread-Index"])).toHaveLength(27);
    expect(headers["Thread-Topic"]).toBe("feedback note please");
  });

  it("derives Thread-Topic from the subject when the inbound one is absent", () => {
    const headers = buildOutlookThreadHeaders(
      { "thread-index": buildParentIndex(PARENT_MS) },
      "Re: RE: Leave question",
      PARENT_MS
    );

    expect(headers["Thread-Topic"]).toBe("Leave question");
  });

  it("omits Thread-Topic when no candidate is printable ASCII", () => {
    const headers = buildOutlookThreadHeaders(
      { "thread-index": buildParentIndex(PARENT_MS), "thread-topic": "Congé" },
      "Re: Congé",
      PARENT_MS
    );

    expect(headers["Thread-Index"]).toBeDefined();
    expect(headers).not.toHaveProperty("Thread-Topic");
  });

  it("returns no headers when the inbound email has no valid Thread-Index", () => {
    expect(buildOutlookThreadHeaders({ "thread-topic": "Topic" }, "Topic", PARENT_MS)).toEqual({});
    expect(buildOutlookThreadHeaders(undefined, "Topic", PARENT_MS)).toEqual({});
  });
});
