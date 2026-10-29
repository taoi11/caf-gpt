/**
 * tests/unit/InboundEmail.test.ts
 *
 * Unit tests for mapping Resend's raw MIME into ParsedEmailData and the sender-authentication rule
 *
 * Top-level declarations:
 * - encode: Encodes a raw MIME fixture
 * - parseInboundEmail suite: envelope vs RFC fields, lowercase header map, threading ids,
 *   HTML fallback, quote headers, and Date handling
 * - buildEnvelopeEmailData suite: envelope-only fallback
 * - isSenderAuthenticated suite: DMARC or DKIM pass only; null is unauthenticated
 */

import { describe, expect, it } from "vitest";
import {
  buildEnvelopeEmailData,
  isSenderAuthenticated,
  parseInboundEmail,
} from "../../src/email/resend/InboundEmail";

/** Encodes a raw MIME fixture. */
function encode(lines: string[]): Uint8Array {
  return new TextEncoder().encode(lines.join("\r\n"));
}

const envelope = { from: "Member@Forces.gc.ca", to: "Agent@CAF-GPT.com" };

describe("parseInboundEmail", () => {
  it("maps RFC fields, envelope, threading ids, and a lowercase header map", async () => {
    const parsed = await parseInboundEmail(
      encode([
        'From: "Doe, Cpl Jane" <member@forces.gc.ca>',
        "Reply-To: member@forces.gc.ca",
        "To: CAF-GPT <agent@caf-gpt.com>, ally@forces.gc.ca",
        "Cc: Second <second@forces.gc.ca>",
        "Subject: Leave question",
        "Message-ID: <current@forces.gc.ca>",
        "In-Reply-To: <parent@forces.gc.ca>",
        "References: <root@forces.gc.ca> <parent@forces.gc.ca>",
        "Thread-Topic: Leave question",
        "Received: one",
        "Received: two",
        "Date: Wed, 28 Oct 2026 17:29:00 +0000",
        "Content-Type: text/plain; charset=utf-8",
        "",
        "Can I take leave?",
      ]),
      envelope
    );

    expect(parsed).toMatchObject({
      envelopeFrom: "member@forces.gc.ca",
      envelopeTo: "agent@caf-gpt.com",
      from: "member@forces.gc.ca",
      replyTo: ["member@forces.gc.ca"],
      replyToPresent: true,
      to: ["agent@caf-gpt.com", "ally@forces.gc.ca"],
      cc: ["second@forces.gc.ca"],
      subject: "Leave question",
      messageId: "<current@forces.gc.ca>",
      inReplyTo: "<parent@forces.gc.ca>",
      references: "<root@forces.gc.ca> <parent@forces.gc.ca>",
    });
    expect(parsed.body.trim()).toBe("Can I take leave?");
    expect(parsed.headers?.["thread-topic"]).toBe("Leave question");
    expect(parsed.headers?.received).toBe("one, two");
    expect(parsed.quoteHeaders).toMatchObject({
      from: "Doe, Cpl Jane <member@forces.gc.ca>",
      to: ["CAF-GPT <agent@caf-gpt.com>", "ally@forces.gc.ca"],
      cc: ["Second <second@forces.gc.ca>"],
    });
    expect(parsed.quoteHeaders?.sent?.toISOString()).toBe("2026-10-28T17:29:00.000Z");
  });

  it("falls back to the HTML part as text and never invents a quote Sent time", async () => {
    const parsed = await parseInboundEmail(
      encode([
        "From: member@forces.gc.ca",
        "To: agent@caf-gpt.com",
        "Subject: Html only",
        "Content-Type: text/html; charset=utf-8",
        "",
        "<p>Hello <b>there</b></p>",
      ]),
      envelope
    );

    expect(parsed.body).toContain("Hello");
    expect(parsed.html).toContain("<b>there</b>");
    expect(parsed.replyToPresent).toBe(false);
    expect(parsed.quoteHeaders?.sent).toBeUndefined();
  });
});

describe("buildEnvelopeEmailData", () => {
  it("keeps only the normalized envelope", () => {
    expect(buildEnvelopeEmailData(envelope)).toMatchObject({
      envelopeFrom: "member@forces.gc.ca",
      envelopeTo: "agent@caf-gpt.com",
      from: "member@forces.gc.ca",
      to: ["agent@caf-gpt.com"],
      replyTo: [],
      body: "",
    });
  });
});

describe("isSenderAuthenticated", () => {
  it.each([
    [{ spf: "pass", dkim: "pass", dmarc: "pass" }, true],
    [{ spf: "fail", dkim: "gray", dmarc: "pass" }, true],
    [{ spf: "pass", dkim: "pass", dmarc: "unknown" }, true],
    [{ spf: "pass", dkim: "gray", dmarc: "unknown" }, false],
    [{ spf: "pass", dkim: "fail", dmarc: "fail" }, false],
    [{ spf: "processing_failed", dkim: "processing_failed", dmarc: "processing_failed" }, false],
  ] as const)("returns the expected verdict for %j", (authentication, expected) => {
    expect(isSenderAuthenticated(authentication)).toBe(expected);
  });

  it("treats missing results as unauthenticated", () => {
    expect(isSenderAuthenticated(null)).toBe(false);
  });
});
