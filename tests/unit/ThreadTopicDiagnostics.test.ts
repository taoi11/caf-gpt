/**
 * tests/unit/ThreadTopicDiagnostics.test.ts
 *
 * Unit tests for boolean-only conversation-topic diagnostics
 *
 * Top-level declarations:
 * - hasSubjectTag suite: Verifies gateway tag detection around reply/forward prefixes
 * - describeThreadTopic suite: Verifies presence/match booleans and that no values leak
 */

import { describe, expect, it } from "vitest";
import { describeThreadTopic, hasSubjectTag } from "../../src/email/utils/ThreadTopicDiagnostics";

describe("hasSubjectTag", () => {
  it.each([
    "[EXTERNAL] Leave request",
    "Re: [EXTERNAL] Leave request",
    "[EXTERNAL] RE: Leave request",
    "FW: [Ext] Leave request",
    "RE: FW: [External Sender] Leave request",
    "CAUTION: Leave request",
    "EXTERNAL: Leave request",
    "Re: CAUTION: Leave request",
    "*EXTERNAL* Leave request",
    "EXTERNAL - Leave request",
    "  [EXTERNAL]Leave request",
  ])("detects a tag in %j", (subject) => {
    expect(hasSubjectTag(subject)).toBe(true);
  });

  it.each([
    "Leave request",
    "Re: Leave request",
    "RE[2]: FW: Leave request",
    "Re: Leave request [EXTERNAL]",
    "Re: Externally funded course",
    "Cautionary tale",
    "[2] Leave request",
    "EXT-123 ticket",
    "",
  ])("finds no tag in %j", (subject) => {
    expect(hasSubjectTag(subject)).toBe(false);
  });

  it("stops after a bounded number of stacked prefixes", () => {
    expect(hasSubjectTag(`${"Re: ".repeat(20)}[EXTERNAL] Leave request`)).toBe(false);
  });
});

describe("describeThreadTopic", () => {
  it("reports no topic when the inbound has no Thread-Topic", () => {
    expect(describeThreadTopic({}, "Re: Leave request")).toEqual({
      threadTopicPresent: false,
      threadTopicMatches: false,
      subjectHasTag: false,
    });
    expect(describeThreadTopic(undefined, "Leave request").threadTopicPresent).toBe(false);
    expect(describeThreadTopic({ "thread-topic": "   " }, "").threadTopicPresent).toBe(false);
  });

  it("matches the subject without reply prefixes, ignoring case and whitespace", () => {
    expect(
      describeThreadTopic({ "thread-topic": " leave  REQUEST " }, "RE: Re[2]: Leave request")
    ).toEqual({ threadTopicPresent: true, threadTopicMatches: true, subjectHasTag: false });
  });

  it("reports a mismatch when a gateway tag changed the subject", () => {
    expect(
      describeThreadTopic({ "thread-topic": "Leave request" }, "[EXTERNAL] Re: Leave request")
    ).toEqual({ threadTopicPresent: true, threadTopicMatches: false, subjectHasTag: true });
  });

  it("reports a mismatch when a forward marker stays in the derived topic", () => {
    const result = describeThreadTopic({ "thread-topic": "Leave request" }, "FW: Leave request");
    expect(result.threadTopicMatches).toBe(false);
    expect(result.subjectHasTag).toBe(false);
  });

  it("returns exactly the three boolean fields", () => {
    expect(
      describeThreadTopic({ "thread-topic": "Leave request" }, "Re: [EXTERNAL] Leave request")
    ).toStrictEqual({ threadTopicPresent: true, threadTopicMatches: false, subjectHasTag: true });
  });
});
