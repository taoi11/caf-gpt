/**
 * tests/unit/ReplyRecipients.test.ts
 *
 * Unit tests for Outlook-style successful-response recipient resolution
 *
 * Top-level declarations:
 * - ReplyRecipients test suite: Verifies primary selection, filtering, ordering, and limits
 */

import { describe, expect, it } from "vitest";
import type { AppConfig } from "../../src/config";
import { resolveReplyRecipients } from "../../src/email/utils/ReplyRecipients";
import { EmailValidationError } from "../../src/errors";
import { createMockParsedEmail } from "../mocks/email";

const config: AppConfig = {
  email: {
    agentFromEmail: "agent@caf-gpt.com",
    monitoredAddresses: ["agent@caf-gpt.com", "pacenote@caf-gpt.com"],
  },
  authorization: {
    authorizedDomains: ["forces.gc.ca"],
    authorizedEmails: ["ally@example.com"],
  },
  llm: {
    models: {
      primeFoo: { model: "test", temperature: 0, maxOutputTokens: 1 },
      leaveFoo: { model: "test", temperature: 0, maxOutputTokens: 1 },
      paceFoo: { model: "test", temperature: 0, maxOutputTokens: 1 },
      doadFoo: { model: "test", temperature: 0, maxOutputTokens: 1 },
      qroFoo: { model: "test", temperature: 0, maxOutputTokens: 1 },
      memoryFoo: { model: "test", temperature: 0, maxOutputTokens: 1 },
    },
  },
};

describe("resolveReplyRecipients", () => {
  it("uses every valid unique Reply-To mailbox as a primary recipient", () => {
    const result = resolveReplyRecipients(
      createMockParsedEmail({
        replyTo: ["First@outside.example", "second@example.net", "FIRST@outside.example"],
        replyToPresent: true,
      }),
      config
    );

    expect(result).toEqual({
      to: ["first@outside.example", "second@example.net"],
      cc: [],
    });
  });

  it("ignores malformed Reply-To values when valid mailboxes remain", () => {
    const result = resolveReplyRecipients(
      createMockParsedEmail({
        replyTo: ["not-an-address", "valid@example.net"],
        replyToPresent: true,
      }),
      config
    );

    expect(result.to).toEqual(["valid@example.net"]);
  });

  it("falls back to RFC From when Reply-To has no valid mailbox", () => {
    const result = resolveReplyRecipients(
      createMockParsedEmail({
        envelopeFrom: "authorized@forces.gc.ca",
        from: "External@outside.example",
        replyTo: ["not-an-address"],
        replyToPresent: true,
      }),
      config
    );

    expect(result.to).toEqual(["external@outside.example"]);
  });

  it("collects original To then Cc in stable order without authorization filtering", () => {
    const result = resolveReplyRecipients(
      createMockParsedEmail({
        to: ["first@example.net", "second@outside.example"],
        cc: ["third@example.org", "ally@example.com"],
      }),
      config
    );

    expect(result.cc).toEqual([
      "first@example.net",
      "second@outside.example",
      "third@example.org",
      "ally@example.com",
    ]);
  });

  it("removes service addresses, primary recipients, sender identities, and malformed values", () => {
    const result = resolveReplyRecipients(
      createMockParsedEmail({
        envelopeFrom: "envelope@forces.gc.ca",
        from: "header@example.net",
        replyTo: ["primary@example.org"],
        replyToPresent: true,
        to: [
          "agent@caf-gpt.com",
          "other@caf-gpt.com",
          "primary@example.org",
          "envelope@forces.gc.ca",
        ],
        cc: ["header@example.net", "not-an-address", "kept@outside.example"],
      }),
      config
    );

    expect(result).toEqual({
      to: ["primary@example.org"],
      cc: ["kept@outside.example"],
    });
  });

  it("removes configured self addresses outside the CAF-GPT domain", () => {
    const externalAliasConfig: AppConfig = {
      ...config,
      email: {
        agentFromEmail: "service@forces.gc.ca",
        monitoredAddresses: ["service@forces.gc.ca", "pace@example.net"],
      },
    };
    const result = resolveReplyRecipients(
      createMockParsedEmail({
        to: ["service@forces.gc.ca", "pace@example.net", "member@example.net"],
      }),
      externalAliasConfig
    );

    expect(result.cc).toEqual(["member@example.net"]);
  });

  it("deduplicates recipients case-insensitively while preserving first occurrence order", () => {
    const result = resolveReplyRecipients(
      createMockParsedEmail({
        replyTo: ["Primary@example.net"],
        replyToPresent: true,
        to: ["First@example.net", "first@example.net"],
        cc: ["FIRST@EXAMPLE.NET", "Second@example.net", "second@example.net"],
      }),
      config
    );

    expect(result.cc).toEqual(["first@example.net", "second@example.net"]);
  });

  it("cannot propagate Bcc because ParsedEmailData has no Bcc field", () => {
    const email = createMockParsedEmail({ to: ["visible@example.net"], cc: [] });
    const withBcc = { ...email, bcc: ["hidden@example.net"] };

    expect(resolveReplyRecipients(withBcc, config).cc).toEqual(["visible@example.net"]);
  });

  it("accepts exactly 50 combined To and Cc recipients", () => {
    const replyTo = ["first@example.net", "second@example.net"];
    const cc = Array.from({ length: 48 }, (_, index) => `member${index}@example.net`);

    const result = resolveReplyRecipients(
      createMockParsedEmail({ replyTo, replyToPresent: true, to: cc, cc: [] }),
      config
    );

    expect(result.to).toHaveLength(2);
    expect(result.cc).toHaveLength(48);
  });

  it("rejects 51 combined recipients rather than truncating", () => {
    const replyTo = ["first@example.net", "second@example.net"];
    const cc = Array.from({ length: 49 }, (_, index) => `member${index}@example.net`);

    expect(() =>
      resolveReplyRecipients(
        createMockParsedEmail({ replyTo, replyToPresent: true, to: cc, cc: [] }),
        config
      )
    ).toThrow(EmailValidationError);
  });
});
