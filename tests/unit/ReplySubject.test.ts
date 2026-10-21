/**
 * tests/unit/ReplySubject.test.ts
 *
 * Unit tests for reply subject normalization
 *
 * Top-level declarations:
 * - normalizeReplySubject suite: Verifies a single "Re: " prefix without stacking
 */

import { describe, expect, it } from "vitest";
import { normalizeReplySubject } from "../../src/email/utils/ReplySubject";

describe("normalizeReplySubject", () => {
  it.each([
    ["Leave question", "Re: Leave question"],
    ["Re: Leave question", "Re: Leave question"],
    ["RE: Leave question", "Re: Leave question"],
    ["re:Leave question", "Re: Leave question"],
    ["Re: RE: re: Leave question", "Re: Leave question"],
    ["RE: Re[2]: Leave question", "Re: Leave question"],
    ["AW: SV: Antw: Leave question", "Re: Leave question"],
    ["  Re :  Leave question  ", "Re: Leave question"],
    ["FW: Leave question", "Re: FW: Leave question"],
    ["RE: FW: Leave question", "Re: FW: Leave question"],
    ["Recruiting update", "Re: Recruiting update"],
    ["Rebuttal: draft", "Re: Rebuttal: draft"],
    ["", "Re:"],
    ["RE:", "Re:"],
  ])("%j -> %j", (input, expected) => {
    expect(normalizeReplySubject(input)).toBe(expected);
  });
});
