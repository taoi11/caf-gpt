/**
 * tests/unit/ReplyRecipients.test.ts
 *
 * Unit tests for safe successful-response recipient resolution
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
  it("uses one valid authorized Reply-To as the primary recipient", () => {
    const result = resolveReplyRecipients(
      createMockParsedEmail({ replyTo: ["TEST@forces.gc.ca"], replyToPresent: true }),
      config
    );

    expect(result.to).toBe("test@forces.gc.ca");
    expect(result.primarySource).toBe("reply-to");
  });

  it("falls back to the authorized RFC From when Reply-To is absent", () => {
    const result = resolveReplyRecipients(
      createMockParsedEmail({
        envelopeFrom: "member@forces.gc.ca",
        from: "Member@forces.gc.ca",
        replyTo: [],
        replyToPresent: false,
      }),
      config
    );

    expect(result.to).toBe("member@forces.gc.ca");
    expect(result.primarySource).toBe("from");
  });

  it("rejects an RFC From that differs from the SMTP envelope principal", () => {
    expect(() =>
      resolveReplyRecipients(
        createMockParsedEmail({
          envelopeFrom: "test@forces.gc.ca",
          from: "other@forces.gc.ca",
        }),
        config
      )
    ).toThrow("RFC From must match the SMTP envelope sender");
  });

  it("rejects delegated Reply-To identity without a server-side ACL", () => {
    expect(() =>
      resolveReplyRecipients(
        createMockParsedEmail({
          replyTo: ["delegate@forces.gc.ca"],
          replyToPresent: true,
        }),
        config
      )
    ).toThrow("Reply-To must match the SMTP envelope sender");
  });

  it.each([
    ["multiple", ["one@forces.gc.ca", "two@forces.gc.ca"]],
    ["malformed", ["not-an-address"]],
    ["unauthorized", ["person@example.net"]],
    ["self-loop", ["agent@caf-gpt.com"]],
  ])("rejects %s Reply-To values", (_label, replyTo) => {
    expect(() =>
      resolveReplyRecipients(createMockParsedEmail({ replyTo, replyToPresent: true }), config)
    ).toThrow(EmailValidationError);
  });

  it("rejects a present Reply-To header that yielded no mailbox", () => {
    expect(() =>
      resolveReplyRecipients(createMockParsedEmail({ replyTo: [], replyToPresent: true }), config)
    ).toThrow(EmailValidationError);
  });

  it("collects original To then Cc in stable order", () => {
    const result = resolveReplyRecipients(
      createMockParsedEmail({
        to: ["first@forces.gc.ca", "second@forces.gc.ca"],
        cc: ["third@forces.gc.ca", "ally@example.com"],
      }),
      config
    );

    expect(result.cc).toEqual([
      "first@forces.gc.ca",
      "second@forces.gc.ca",
      "third@forces.gc.ca",
      "ally@example.com",
    ]);
  });

  it("removes CAF-GPT aliases and every address on the service domain", () => {
    const result = resolveReplyRecipients(
      createMockParsedEmail({
        to: ["agent@caf-gpt.com", "other@caf-gpt.com", "member@forces.gc.ca"],
        cc: ["pacenote@caf-gpt.com"],
      }),
      config
    );

    expect(result.cc).toEqual(["member@forces.gc.ca"]);
    expect(result.filteringSummary.cafGpt).toBe(3);
  });

  it("removes configured sender aliases even when they use an authorized external domain", () => {
    const externalAliasConfig: AppConfig = {
      ...config,
      email: {
        agentFromEmail: "service@forces.gc.ca",
        monitoredAddresses: ["service@forces.gc.ca"],
      },
    };
    const result = resolveReplyRecipients(
      createMockParsedEmail({ to: ["service@forces.gc.ca", "member@forces.gc.ca"] }),
      externalAliasConfig
    );

    expect(result.cc).toEqual(["member@forces.gc.ca"]);
    expect(result.filteringSummary.configuredSelf).toBe(1);
  });

  it("removes repeated instances of the bound primary principal", () => {
    const result = resolveReplyRecipients(
      createMockParsedEmail({
        envelopeFrom: "test@forces.gc.ca",
        from: "test@forces.gc.ca",
        replyTo: ["test@forces.gc.ca"],
        replyToPresent: true,
        to: ["test@forces.gc.ca", "TEST@forces.gc.ca", "kept@forces.gc.ca"],
      }),
      config
    );

    expect(result.cc).toEqual(["kept@forces.gc.ca"]);
    expect(result.filteringSummary.primaryRecipient).toBe(2);
  });

  it("drops malformed and unauthorized candidates without leaking them", () => {
    const result = resolveReplyRecipients(
      createMockParsedEmail({
        to: ["valid@forces.gc.ca", "not-an-address"],
        cc: ["outsider@example.net"],
      }),
      config
    );

    expect(result.cc).toEqual(["valid@forces.gc.ca"]);
    expect(result.filteringSummary.malformed).toBe(1);
    expect(result.filteringSummary.unauthorized).toBe(1);
  });

  it("deduplicates case-insensitively while preserving the first occurrence", () => {
    const result = resolveReplyRecipients(
      createMockParsedEmail({
        to: ["First@forces.gc.ca", "first@forces.gc.ca"],
        cc: ["FIRST@forces.gc.ca", "second@forces.gc.ca"],
      }),
      config
    );

    expect(result.cc).toEqual(["first@forces.gc.ca", "second@forces.gc.ca"]);
    expect(result.filteringSummary.duplicate).toBe(2);
  });

  it("cannot propagate Bcc because ParsedEmailData has no Bcc field", () => {
    const email = createMockParsedEmail({ to: ["visible@forces.gc.ca"], cc: [] });
    const withBcc = { ...email, bcc: ["hidden@forces.gc.ca"] };

    expect(resolveReplyRecipients(withBcc, config).cc).toEqual(["visible@forces.gc.ca"]);
  });

  it("accepts exactly 50 combined recipients", () => {
    const cc = Array.from({ length: 49 }, (_, index) => `member${index}@forces.gc.ca`);

    expect(
      resolveReplyRecipients(createMockParsedEmail({ to: cc, cc: [] }), config).cc
    ).toHaveLength(49);
  });

  it("rejects 51 combined recipients rather than truncating", () => {
    const cc = Array.from({ length: 50 }, (_, index) => `member${index}@forces.gc.ca`);

    expect(() => resolveReplyRecipients(createMockParsedEmail({ to: cc, cc: [] }), config)).toThrow(
      EmailValidationError
    );
  });

  it("matches exact authorized emails and authorized domains only", () => {
    const result = resolveReplyRecipients(
      createMockParsedEmail({
        to: [
          "ally@example.com",
          "member@forces.gc.ca",
          "ally+tag@example.com",
          "member@sub.forces.gc.ca",
        ],
      }),
      config
    );

    expect(result.cc).toEqual(["ally@example.com", "member@forces.gc.ca"]);
    expect(result.filteringSummary.unauthorized).toBe(2);
  });
});
