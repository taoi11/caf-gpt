/**
 * tests/unit/LogRedaction.test.ts
 *
 * Unit tests for privacy-preserving email-path log helpers and safe error metadata
 *
 * Tests:
 * - toLoggableErrorName/toLoggableErrorCode pass allowlisted values and classify everything else
 * - every AI_* error name in the installed AI SDK builds is allowlisted (drift guard)
 * - getLogSafeDomain returns only the domain portion of an address
 * - createEmailRef is random, 16 hex chars, and unique per call
 * - getEmailRefFromHeaders reuses a well-formed Worker ref and never falls back to a shared constant
 * - getSafeErrorMetadata never leaks non-allowlisted error names or codes
 * - toLoggableShortlistDiagnostics keeps only allowlisted numeric/boolean fields and the fixed stage code
 * - toLoggableQuoteDiagnostics keeps only quote flags, counts, and the fixed failure reason
 * - toLoggableSentZoneDiagnostics keeps only the zone source, offset, found flag, and fixed reason
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createEmailRef,
  EMAIL_REF_HEADER,
  getAiUpstreamCode,
  getEmailRefFromHeaders,
  getLogSafeDomain,
  OTHER_ERROR_CODE,
  OTHER_ERROR_NAME,
  toLoggableErrorCode,
  toLoggableErrorName,
  toLoggableQuoteDiagnostics,
  toLoggableSentZoneDiagnostics,
  toLoggableShortlistDiagnostics,
} from "../../src/email/utils/LogRedaction";
import { EmailParsingError, QuotedHistoryError } from "../../src/errors";
import { getSafeErrorMetadata } from "../../src/Logger";

const EMAIL_REF_PATTERN = /^[0-9a-f]{16}$/;

describe("getAiUpstreamCode", () => {
  /** Builds an error with the given name and message. */
  function namedError(name: string, message: string): Error {
    const error = new Error(message);
    error.name = name;
    return error;
  }

  it("returns only the leading numeric code of a Workers AI binding error", () => {
    expect(getAiUpstreamCode(namedError("InferenceUpstreamError", "5006: bad input text"))).toBe(
      5006
    );
    expect(getAiUpstreamCode(namedError("AiInternalError", "3040: capacity"))).toBe(3040);
  });

  it("returns undefined for other errors and for messages without a leading code", () => {
    expect(getAiUpstreamCode(namedError("Error", "5006: looks like a code"))).toBeUndefined();
    expect(
      getAiUpstreamCode(namedError("InferenceUpstreamError", "raw body 5006:"))
    ).toBeUndefined();
    expect(
      getAiUpstreamCode(namedError("InferenceUpstreamError", "user@forces.gc.ca"))
    ).toBeUndefined();
    expect(getAiUpstreamCode("5006: string")).toBeUndefined();
  });
});

describe("toLoggableErrorName", () => {
  it("passes allowlisted built-in, app, and AI SDK error names", () => {
    expect(toLoggableErrorName("TypeError")).toBe("TypeError");
    expect(toLoggableErrorName("EmailParsingError")).toBe("EmailParsingError");
    expect(toLoggableErrorName("AI_APICallError")).toBe("AI_APICallError");
    expect(toLoggableErrorName("InferenceUpstreamError")).toBe("InferenceUpstreamError");
    expect(toLoggableErrorName("AiInternalError")).toBe("AiInternalError");
  });

  it("classifies identifier-shaped and free-text unknown names as OtherError", () => {
    expect(toLoggableErrorName("ProjectFalcon")).toBe(OTHER_ERROR_NAME);
    expect(toLoggableErrorName("Delivery to user@forces.gc.ca failed")).toBe(OTHER_ERROR_NAME);
    expect(toLoggableErrorName("")).toBe(OTHER_ERROR_NAME);
    expect(toLoggableErrorName(undefined)).toBe(OTHER_ERROR_NAME);
  });
});

describe("AI SDK error name allowlist", () => {
  it("covers every AI_* error name in the installed ai and @ai-sdk/provider builds", () => {
    const require = createRequire(import.meta.url);
    const sdkNames = new Set<string>();
    for (const pkg of ["ai", "@ai-sdk/provider"]) {
      const packageDir = dirname(require.resolve(`${pkg}/package.json`));
      const source = readFileSync(join(packageDir, "dist", "index.mjs"), "utf8");
      for (const match of source.matchAll(/"(AI_[A-Za-z]+Error)"/g)) {
        sdkNames.add(match[1]);
      }
    }

    expect(sdkNames.size).toBeGreaterThan(0);
    const missing = [...sdkNames].filter((name) => toLoggableErrorName(name) !== name);
    expect(missing).toEqual([]);
  });
});

describe("toLoggableErrorCode", () => {
  it("passes allowlisted app codes and classifies the rest as other", () => {
    expect(toLoggableErrorCode("EMAIL_PARSING_ERROR")).toBe("EMAIL_PARSING_ERROR");
    expect(toLoggableErrorCode("ProjectFalcon")).toBe(OTHER_ERROR_CODE);
    expect(toLoggableErrorCode("rejected user@forces.gc.ca")).toBe(OTHER_ERROR_CODE);
  });
});

describe("getLogSafeDomain", () => {
  it("returns only the lowercase domain", () => {
    expect(getLogSafeDomain("Luffy.Dhaliwal@Forces.GC.ca")).toBe("forces.gc.ca");
    expect(getLogSafeDomain("Name <Someone@Example.com>")).toBe("example.com");
  });

  it("returns empty or invalid markers instead of raw input", () => {
    expect(getLogSafeDomain("")).toBe("");
    expect(getLogSafeDomain(undefined)).toBe("");
    expect(getLogSafeDomain("no-at-sign")).toBe("");
    expect(getLogSafeDomain("a@bad domain with spaces")).toBe("invalid");
  });
});

describe("createEmailRef", () => {
  it("returns 16 hex characters that differ on every call", () => {
    const refs = new Set(Array.from({ length: 50 }, () => createEmailRef()));
    expect(refs.size).toBe(50);
    for (const ref of refs) {
      expect(ref).toMatch(EMAIL_REF_PATTERN);
    }
  });
});

describe("getEmailRefFromHeaders", () => {
  it("reuses the Worker-assigned ref", () => {
    const ref = createEmailRef();
    expect(getEmailRefFromHeaders(new Headers({ [EMAIL_REF_HEADER]: ref }))).toBe(ref);
  });

  it("generates distinct fresh refs when the header is missing or malformed", () => {
    const missingA = getEmailRefFromHeaders(new Headers());
    const missingB = getEmailRefFromHeaders(new Headers());
    const malformed = getEmailRefFromHeaders(
      new Headers({ [EMAIL_REF_HEADER]: "user@forces.gc.ca" })
    );

    expect(missingA).toMatch(EMAIL_REF_PATTERN);
    expect(missingB).toMatch(EMAIL_REF_PATTERN);
    expect(missingA).not.toBe(missingB);
    expect(malformed).toMatch(EMAIL_REF_PATTERN);
    expect([missingA, missingB, malformed]).not.toContain("none");
  });
});

describe("getSafeErrorMetadata", () => {
  it("keeps allowlisted names and codes", () => {
    expect(getSafeErrorMetadata(new EmailParsingError("secret body text"))).toMatchObject({
      errorName: "EmailParsingError",
      errorCode: "EMAIL_PARSING_ERROR",
    });
  });

  it("classifies unknown identifier-shaped and free-text names and codes", () => {
    const tokenError = new Error("message text");
    tokenError.name = "ProjectFalcon";
    Object.assign(tokenError, { code: "ProjectFalcon" });
    expect(getSafeErrorMetadata(tokenError)).toEqual({
      errorName: OTHER_ERROR_NAME,
      errorCode: OTHER_ERROR_CODE,
    });

    const textError = new Error("message text");
    textError.name = "Delivery to user@forces.gc.ca failed";
    Object.assign(textError, { code: "rejected recipient user@forces.gc.ca" });
    const metadata = getSafeErrorMetadata(textError);
    expect(metadata).toEqual({ errorName: OTHER_ERROR_NAME, errorCode: OTHER_ERROR_CODE });
    expect(JSON.stringify(metadata)).not.toContain("@");
  });

  it("classifies non-Error values without echoing them", () => {
    expect(getSafeErrorMetadata("user@forces.gc.ca")).toEqual({ errorName: "UnknownError" });
  });
});

describe("toLoggableShortlistDiagnostics", () => {
  const group = {
    optionCount: 9,
    rankReached: 1,
    topIsNone: false,
    topConfidence: 0.82,
    topMargin: 0.7,
  };
  const document = {
    optionCount: 82,
    rankReached: 1,
    topIsNone: true,
    topConfidence: 0.41,
    topMargin: 0.05,
  };

  it("keeps the stage code and per-stage numbers under stage-named fields", () => {
    expect(toLoggableShortlistDiagnostics({ shortlistStage: "document", group, document })).toEqual(
      { shortlistStage: "document", shortlistGroup: group, shortlistDocument: document }
    );
  });

  it("drops strings, unknown fields, unknown stages, and non-finite numbers", () => {
    const untrusted = JSON.parse(
      JSON.stringify({
        shortlistStage: "member question text",
        question: "What is my leave entitlement?",
        choice: "doc_4",
        group: {
          optionCount: "9",
          rankReached: "1",
          topIsNone: "no",
          topConfidence: "high",
          title: "Leave Regulations",
        },
        document: { topChoice: "vol-1-administration/ch-16-leave.md", topMargin: 0.2 },
        extra: { optionCount: 3 },
      })
    );
    untrusted.group.topMargin = Number.POSITIVE_INFINITY;
    const logged = toLoggableShortlistDiagnostics(untrusted);
    expect(logged).toEqual({ shortlistGroup: {}, shortlistDocument: { topMargin: 0.2 } });
    const serialized = JSON.stringify(logged);
    for (const content of ["leave", "Leave", "doc_4", "member", "vol-1", "extra"]) {
      expect(serialized).not.toContain(content);
    }
  });

  it("returns no fields for missing diagnostics", () => {
    expect(toLoggableShortlistDiagnostics(undefined)).toEqual({});
  });
});

describe("toLoggableQuoteDiagnostics", () => {
  it("keeps quote flags and counts", () => {
    expect(
      toLoggableQuoteDiagnostics({
        quotedHistoryIncluded: true,
        quotedHtml: true,
        quoteSourceBytes: 1234,
        quoteRemovedNodes: 3,
      })
    ).toEqual({
      quotedHistoryIncluded: true,
      quotedHtml: true,
      quoteSourceBytes: 1234,
      quoteRemovedNodes: 3,
    });
  });

  it("drops content, unknown reasons, and non-count numbers", () => {
    const untrusted = JSON.parse(
      JSON.stringify({
        quotedHistoryIncluded: "yes",
        quotedHtml: "<p>body</p>",
        quoteSourceBytes: -1,
        quoteRemovedNodes: 1.5,
        quoteFailureReason: "Luffy <luffy@forces.gc.ca>",
        subject: "RE: feedback note please",
      })
    );
    const logged = toLoggableQuoteDiagnostics(untrusted);
    expect(logged).toEqual({ quotedHistoryIncluded: false });
    expect(JSON.stringify(logged)).not.toMatch(/luffy|feedback|body/i);
  });

  it("keeps the fixed failure reason", () => {
    expect(
      toLoggableQuoteDiagnostics({
        quotedHistoryIncluded: false,
        quoteFailureReason: "quote_missing_date",
      })
    ).toEqual({ quotedHistoryIncluded: false, quoteFailureReason: "quote_missing_date" });
  });

  it("logs QuotedHistoryError by its allowlisted name and composition code only", () => {
    expect(getSafeErrorMetadata(new QuotedHistoryError("quote_missing_sender"))).toEqual({
      errorName: "QuotedHistoryError",
      errorCode: "EMAIL_COMPOSITION_ERROR",
      recoverable: false,
    });
  });
});

describe("toLoggableSentZoneDiagnostics", () => {
  it("keeps only the zone source, offset, found flag, and fixed reason", () => {
    // A SentZoneDecision also carries the zone; extra keys never reach the log fields.
    const decision = {
      source: "learned" as const,
      offsetMinutes: -180,
      lineFound: true,
      zone: { offsetMinutes: -180 },
      sent: "October 28, 2026 2:30 PM",
    };
    expect(toLoggableSentZoneDiagnostics(decision)).toEqual({
      quoteSentZoneSource: "learned",
      quoteSentOffsetMinutes: -180,
      quoteSentLineFound: true,
    });
  });

  it("drops unknown reasons and out-of-range offsets", () => {
    expect(
      // SAFETY: deliberately invalid values prove the allowlist rejects them.
      toLoggableSentZoneDiagnostics({
        source: "agent@caf-gpt.com",
        offsetMinutes: 9999,
        lineFound: true,
        reason: "October 28, 2026 2:30 PM",
      } as never)
    ).toEqual({ quoteSentZoneSource: "default", quoteSentLineFound: true });
    expect(
      toLoggableSentZoneDiagnostics({
        source: "default",
        lineFound: true,
        reason: "quoted_sent_unmatched",
      })
    ).toEqual({
      quoteSentZoneSource: "default",
      quoteSentLineFound: true,
      quoteSentReason: "quoted_sent_unmatched",
    });
  });
});
