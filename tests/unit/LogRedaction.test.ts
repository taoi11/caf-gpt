/**
 * tests/unit/LogRedaction.test.ts
 *
 * Unit tests for privacy-preserving email-path log helpers and safe error metadata
 *
 * Tests:
 * - toLoggableErrorName/toLoggableErrorCode pass allowlisted values and classify everything else
 * - getLogSafeDomain returns only the domain portion of an address
 * - createEmailRef is random, 16 hex chars, and unique per call
 * - getEmailRefFromHeaders reuses a well-formed Worker ref and never falls back to a shared constant
 * - getSafeErrorMetadata never leaks non-allowlisted error names or codes
 */

import { describe, expect, it } from "vitest";
import {
  createEmailRef,
  EMAIL_REF_HEADER,
  getEmailRefFromHeaders,
  getLogSafeDomain,
  OTHER_ERROR_CODE,
  OTHER_ERROR_NAME,
  toLoggableErrorCode,
  toLoggableErrorName,
} from "../../src/email/utils/LogRedaction";
import { EmailParsingError } from "../../src/errors";
import { getSafeErrorMetadata } from "../../src/Logger";

const EMAIL_REF_PATTERN = /^[0-9a-f]{16}$/;

describe("toLoggableErrorName", () => {
  it("passes allowlisted built-in, app, and AI SDK error names", () => {
    expect(toLoggableErrorName("TypeError")).toBe("TypeError");
    expect(toLoggableErrorName("EmailParsingError")).toBe("EmailParsingError");
    expect(toLoggableErrorName("AI_APICallError")).toBe("AI_APICallError");
  });

  it("classifies identifier-shaped and free-text unknown names as OtherError", () => {
    expect(toLoggableErrorName("ProjectFalcon")).toBe(OTHER_ERROR_NAME);
    expect(toLoggableErrorName("Delivery to user@forces.gc.ca failed")).toBe(OTHER_ERROR_NAME);
    expect(toLoggableErrorName("")).toBe(OTHER_ERROR_NAME);
    expect(toLoggableErrorName(undefined)).toBe(OTHER_ERROR_NAME);
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
