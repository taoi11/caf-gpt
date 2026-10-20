/**
 * tests/unit/LogRedaction.test.ts
 *
 * Unit tests for privacy-preserving email-path log helpers and safe error metadata
 *
 * Tests:
 * - toSafeLogToken keeps identifier-like tokens and redacts free text
 * - getLogSafeDomain returns only the domain portion of an address
 * - createEmailRef is deterministic, short, salted, and never echoes the Message-ID
 * - getSafeErrorMetadata never leaks free-text error names or codes
 */

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createEmailRef,
  EMAIL_REF_UNAVAILABLE,
  getLogSafeDomain,
  toSafeLogToken,
} from "../../src/email/utils/LogRedaction";
import { getSafeErrorMetadata } from "../../src/Logger";

describe("toSafeLogToken", () => {
  it("keeps short identifier-like tokens", () => {
    expect(toSafeLogToken("APICallError")).toBe("APICallError");
    expect(toSafeLogToken("ERR_NETWORK.timeout:1")).toBe("ERR_NETWORK.timeout:1");
  });

  it("redacts free text, addresses, and oversize values", () => {
    expect(toSafeLogToken("Failed for user@forces.gc.ca")).toBe("redacted");
    expect(toSafeLogToken("user@forces.gc.ca")).toBe("redacted");
    expect(toSafeLogToken("x".repeat(65))).toBe("redacted");
    expect(toSafeLogToken("")).toBe("redacted");
    expect(toSafeLogToken(undefined, "none")).toBe("none");
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
  it("is deterministic, 16 hex chars, and does not contain the Message-ID", async () => {
    const messageId = "<abc.123@forces.gc.ca>";
    const first = await createEmailRef(messageId);
    const second = await createEmailRef(` ${messageId} `);

    expect(first).toMatch(/^[0-9a-f]{16}$/);
    expect(second).toBe(first);
    expect(first).not.toContain("forces");
  });

  it("is salted rather than a plain SHA-256 prefix of the Message-ID", async () => {
    const messageId = "<abc.123@forces.gc.ca>";
    const plain = createHash("sha256").update(messageId).digest("hex").slice(0, 16);
    await expect(createEmailRef(messageId)).resolves.not.toBe(plain);
  });

  it("differs per Message-ID and reports a marker when missing", async () => {
    await expect(createEmailRef("<a@x>")).resolves.not.toBe(await createEmailRef("<b@x>"));
    await expect(createEmailRef(undefined)).resolves.toBe(EMAIL_REF_UNAVAILABLE);
    await expect(createEmailRef(null)).resolves.toBe(EMAIL_REF_UNAVAILABLE);
    await expect(createEmailRef("   ")).resolves.toBe(EMAIL_REF_UNAVAILABLE);
  });
});

describe("getSafeErrorMetadata", () => {
  it("keeps safe names and codes", () => {
    const error = Object.assign(new TypeError("secret body text"), { code: "E_TIMEOUT" });
    expect(getSafeErrorMetadata(error)).toEqual({ errorName: "TypeError", errorCode: "E_TIMEOUT" });
  });

  it("redacts free-text names and codes that could carry content or addresses", () => {
    const error = new Error("message text");
    error.name = "Delivery to user@forces.gc.ca failed";
    Object.assign(error, { code: "rejected recipient user@forces.gc.ca" });

    const metadata = getSafeErrorMetadata(error);
    expect(metadata).toEqual({ errorName: "Error", errorCode: "redacted" });
    expect(JSON.stringify(metadata)).not.toContain("@");
  });

  it("classifies non-Error values without echoing them", () => {
    expect(getSafeErrorMetadata("user@forces.gc.ca")).toEqual({ errorName: "UnknownError" });
  });
});
