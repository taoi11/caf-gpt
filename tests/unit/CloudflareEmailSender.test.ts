/**
 * tests/unit/CloudflareEmailSender.test.ts
 *
 * Unit tests for CloudflareEmailSender.
 *
 * Each test targets a specific branch of src/email/CloudflareEmailSender.ts:
 * - reply payload construction, returned id, and threading headers
 * - subject "Re:" prefixing (idempotent)
 * - reply-all CC filtering: authorization allowlist (domain + exact email),
 *   self/sender removal, case-insensitive dedup, invalid-address rejection,
 *   and the 50-recipient cap (with boundary)
 * - binding/recipient validation and send-failure wrapping
 * - sender-only, plain-text error responses and their subject derivation
 */

import { describe, expect, it } from "vitest";
import { CloudflareEmailSender } from "../../src/email/CloudflareEmailSender";
import { APIValidationError } from "../../src/errors";
import { createMockParsedEmail } from "../mocks";
import { MockSendEmail } from "../mocks/cloudflare";

const FROM = "agent@caf-gpt.com";
const SELF = ["agent@caf-gpt.com", "pacenote@caf-gpt.com"];
// Mirrors the realistic default from src/config.ts (forces.gc.ca domain + one allowlisted email).
const AUTH = { authorizedDomains: ["forces.gc.ca"], authorizedEmails: ["luffy@luffy.email"] };
const CONTENT = { text: "Plain reply", html: "<p>HTML reply</p>" };

type SentMessage = {
  to: string;
  cc?: string[];
  from: { email: string; name: string };
  replyTo: string;
  subject: string;
  text: string;
  html?: string;
  headers: Record<string, string>;
};

// Common case: a real MockSendEmail so the test can inspect what was sent.
function makeSender(authorization = AUTH, selfAddresses = SELF) {
  const binding = new MockSendEmail();
  const sender = new CloudflareEmailSender(
    FROM,
    binding as unknown as SendEmail,
    selfAddresses,
    authorization
  );
  return { sender, binding };
}

// Typed view of the single message a test's sender dispatched.
function lastSent(binding: MockSendEmail): SentMessage {
  return binding.sentMessages[binding.sentMessages.length - 1] as SentMessage;
}

// A binding whose send() always rejects, to exercise the catch/rethrow path.
const FAILING_BINDING = {
  send: () => Promise.reject(new Error("network down")),
} as unknown as SendEmail;

describe("CloudflareEmailSender", () => {
  describe("sendReply", () => {
    it("builds a complete reply payload for a sender-only email", async () => {
      const { sender, binding } = makeSender();

      const result = await sender.sendReply(
        createMockParsedEmail({ from: "sender@forces.gc.ca", cc: [], subject: "Leave question" }),
        CONTENT,
        { inReplyTo: "<source@forces.gc.ca>", references: "<source@forces.gc.ca>" }
      );

      expect(result.id).toBe("mock-email-1");
      // toEqual is exact: this also proves no `cc` key is present for a sender-only reply.
      expect(lastSent(binding)).toEqual({
        to: "sender@forces.gc.ca",
        from: { email: FROM, name: "CAF-GPT" },
        replyTo: FROM,
        subject: "Re: Leave question",
        text: CONTENT.text,
        html: CONTENT.html,
        headers: {
          "In-Reply-To": "<source@forces.gc.ca>",
          References: "<source@forces.gc.ca>",
        },
      });
    });

    it("returns the id from the binding's messageId", async () => {
      // Fixed-id stub decouples the assertion from MockSendEmail's auto-increment counter.
      const binding = { send: async () => ({ messageId: "cf-msg-abc" }) } as unknown as SendEmail;
      const sender = new CloudflareEmailSender(FROM, binding, SELF, AUTH);

      const result = await sender.sendReply(
        createMockParsedEmail({ from: "sender@forces.gc.ca" }),
        CONTENT,
        {}
      );

      expect(result.id).toBe("cf-msg-abc");
    });

    it("omits threading headers that were not provided", async () => {
      const { sender, binding } = makeSender();

      await sender.sendReply(createMockParsedEmail({ from: "sender@forces.gc.ca" }), CONTENT, {});

      expect(lastSent(binding).headers).toEqual({});
    });

    describe("subject prefixing", () => {
      it("prefixes the subject with 'Re:' when absent", async () => {
        const { sender, binding } = makeSender();

        await sender.sendReply(
          createMockParsedEmail({ from: "sender@forces.gc.ca", subject: "Leave question" }),
          CONTENT,
          {}
        );

        expect(lastSent(binding).subject).toBe("Re: Leave question");
      });

      it("does not double-prefix a subject that already starts with 'Re:'", async () => {
        const { sender, binding } = makeSender();

        await sender.sendReply(
          createMockParsedEmail({ from: "sender@forces.gc.ca", subject: "Re: Leave question" }),
          CONTENT,
          {}
        );

        expect(lastSent(binding).subject).toBe("Re: Leave question");
      });
    });

    describe("reply-all CC handling", () => {
      it("CCs recipients on an authorized domain", async () => {
        const { sender, binding } = makeSender();

        await sender.sendReply(
          createMockParsedEmail({ from: "sender@forces.gc.ca", cc: ["teammate@forces.gc.ca"] }),
          CONTENT,
          {}
        );

        expect(lastSent(binding)).toMatchObject({
          to: "sender@forces.gc.ca",
          cc: ["teammate@forces.gc.ca"],
        });
      });

      it("CCs an exact-allowlisted email even when its domain is not authorized", async () => {
        const { sender, binding } = makeSender();

        // luffy.email is NOT an authorized domain, but luffy@luffy.email is on the email allowlist.
        await sender.sendReply(
          createMockParsedEmail({ from: "sender@forces.gc.ca", cc: ["luffy@luffy.email"] }),
          CONTENT,
          {}
        );

        expect(lastSent(binding).cc).toEqual(["luffy@luffy.email"]);
      });

      it("drops CC recipients that are neither an authorized domain nor an allowlisted email", async () => {
        const { sender, binding } = makeSender();

        await sender.sendReply(
          createMockParsedEmail({ from: "sender@forces.gc.ca", cc: ["civilian@example.com"] }),
          CONTENT,
          {}
        );

        expect(lastSent(binding)).not.toHaveProperty("cc");
      });

      it("matches the authorization allowlist case-insensitively", async () => {
        const { sender, binding } = makeSender({
          authorizedDomains: ["FORCES.GC.CA"],
          authorizedEmails: ["LUFFY@LUFFY.EMAIL"],
        });

        await sender.sendReply(
          createMockParsedEmail({
            from: "sender@forces.gc.ca",
            cc: ["teammate@forces.gc.ca", "luffy@luffy.email"],
          }),
          CONTENT,
          {}
        );

        expect(lastSent(binding).cc).toEqual(["teammate@forces.gc.ca", "luffy@luffy.email"]);
      });

      it("never CCs the primary recipient (the sender)", async () => {
        const { sender, binding } = makeSender();

        // Sender is on an authorized domain, yet must still be excluded as the primary recipient.
        await sender.sendReply(
          createMockParsedEmail({
            from: "sender@forces.gc.ca",
            cc: ["sender@forces.gc.ca", "teammate@forces.gc.ca"],
          }),
          CONTENT,
          {}
        );

        expect(lastSent(binding).cc).toEqual(["teammate@forces.gc.ca"]);
      });

      it("excludes self addresses even when their domain is authorized", async () => {
        const { sender, binding } = makeSender(AUTH, ["agent@caf-gpt.com", "bot@forces.gc.ca"]);

        // bot@forces.gc.ca would pass the domain allowlist, but it is a configured self address.
        await sender.sendReply(
          createMockParsedEmail({
            from: "sender@forces.gc.ca",
            cc: ["bot@forces.gc.ca", "teammate@forces.gc.ca"],
          }),
          CONTENT,
          {}
        );

        expect(lastSent(binding).cc).toEqual(["teammate@forces.gc.ca"]);
      });

      it("de-duplicates CC recipients case-insensitively", async () => {
        const { sender, binding } = makeSender();

        await sender.sendReply(
          createMockParsedEmail({
            from: "sender@forces.gc.ca",
            cc: ["teammate@forces.gc.ca", "Teammate@forces.gc.ca"],
          }),
          CONTENT,
          {}
        );

        expect(lastSent(binding).cc).toEqual(["teammate@forces.gc.ca"]);
      });

      it("throws APIValidationError for an invalid CC address (before the authorization check)", async () => {
        const { sender } = makeSender();

        await expect(
          sender.sendReply(
            createMockParsedEmail({ from: "sender@forces.gc.ca", cc: ["not-an-email"] }),
            CONTENT,
            {}
          )
        ).rejects.toThrow(APIValidationError);
      });

      it("throws APIValidationError when total recipients exceed the 50 limit", async () => {
        const { sender } = makeSender();
        // 50 authorized CC + 1 primary = 51 > 50.
        const cc = Array.from({ length: 50 }, (_, i) => `user${i}@forces.gc.ca`);

        await expect(
          sender.sendReply(createMockParsedEmail({ from: "sender@forces.gc.ca", cc }), CONTENT, {})
        ).rejects.toThrow(APIValidationError);
      });

      it("allows recipients up to the limit", async () => {
        const { sender, binding } = makeSender();
        // 49 authorized CC + 1 primary = 50, the maximum allowed.
        const cc = Array.from({ length: 49 }, (_, i) => `user${i}@forces.gc.ca`);

        await sender.sendReply(
          createMockParsedEmail({ from: "sender@forces.gc.ca", cc }),
          CONTENT,
          {}
        );

        expect(lastSent(binding).cc).toEqual(cc);
      });
    });

    describe("validation & send failure", () => {
      it("throws APIValidationError when the email binding is missing", async () => {
        const sender = new CloudflareEmailSender(FROM, undefined, SELF, AUTH);

        await expect(
          sender.sendReply(createMockParsedEmail({ from: "sender@forces.gc.ca" }), CONTENT, {})
        ).rejects.toThrow(APIValidationError);
      });

      it("throws APIValidationError when the sender address is invalid", async () => {
        const { sender } = makeSender();

        await expect(
          sender.sendReply(createMockParsedEmail({ from: "not-an-email" }), CONTENT, {})
        ).rejects.toThrow(APIValidationError);
      });

      it("wraps a binding send() failure in APIValidationError, preserving the cause", async () => {
        const sender = new CloudflareEmailSender(FROM, FAILING_BINDING, SELF, AUTH);
        const email = createMockParsedEmail({ from: "sender@forces.gc.ca" });

        await expect(sender.sendReply(email, CONTENT, {})).rejects.toThrow(APIValidationError);
        await expect(sender.sendReply(email, CONTENT, {})).rejects.toThrow(/network down/);
      });
    });
  });

  describe("sendErrorResponse", () => {
    it("sends a sender-only plain-text error with no cc and no html", async () => {
      const { sender, binding } = makeSender();

      const result = await sender.sendErrorResponse(
        createMockParsedEmail({ from: "sender@forces.gc.ca", cc: ["teammate@forces.gc.ca"] }),
        "Something failed.",
        { inReplyTo: "<source@forces.gc.ca>" }
      );

      expect(result.id).toBe("mock-email-1");
      expect(lastSent(binding)).toEqual({
        to: "sender@forces.gc.ca",
        from: { email: FROM, name: "CAF-GPT" },
        replyTo: FROM,
        subject: "Error Processing Email",
        text: "Something failed.",
        headers: { "In-Reply-To": "<source@forces.gc.ca>" },
      });
      // Error responses must never copy anyone (even an authorized peer) and never carry HTML.
      expect(lastSent(binding)).not.toHaveProperty("cc");
      expect(lastSent(binding)).not.toHaveProperty("html");
    });

    it("derives 'Error Processing Email: <subject>' when the original starts with 'Re:'", async () => {
      const { sender, binding } = makeSender();

      await sender.sendErrorResponse(
        createMockParsedEmail({ from: "sender@forces.gc.ca", subject: "Re: Leave question" }),
        "Something failed.",
        {}
      );

      expect(lastSent(binding).subject).toBe("Error Processing Email: Leave question");
    });

    it("throws APIValidationError when the email binding is missing", async () => {
      const sender = new CloudflareEmailSender(FROM, undefined, SELF, AUTH);

      await expect(
        sender.sendErrorResponse(
          createMockParsedEmail({ from: "sender@forces.gc.ca" }),
          "Something failed.",
          {}
        )
      ).rejects.toThrow(APIValidationError);
    });

    it("throws APIValidationError when the recipient address is invalid", async () => {
      const { sender } = makeSender();

      await expect(
        sender.sendErrorResponse(
          createMockParsedEmail({ from: "not-an-email" }),
          "Something failed.",
          {}
        )
      ).rejects.toThrow(APIValidationError);
    });

    it("wraps a binding send() failure in APIValidationError, preserving the cause", async () => {
      const sender = new CloudflareEmailSender(FROM, FAILING_BINDING, SELF, AUTH);
      const email = createMockParsedEmail({ from: "sender@forces.gc.ca" });

      await expect(sender.sendErrorResponse(email, "boom", {})).rejects.toThrow(APIValidationError);
      await expect(sender.sendErrorResponse(email, "boom", {})).rejects.toThrow(/network down/);
    });
  });
});
