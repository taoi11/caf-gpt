/**
 * tests/unit/CloudflareEmailSender.test.ts
 *
 * Unit tests for Cloudflare Email Service sender behavior
 *
 * Tests:
 * - Reply payload construction
 * - Reply-all CC filtering
 * - Sender-only error responses
 */

import { describe, expect, it } from "vitest";
import { CloudflareEmailSender } from "../../src/email/CloudflareEmailSender";
import { createMockParsedEmail } from "../mocks";
import { MockSendEmail } from "../mocks/cloudflare";

describe("CloudflareEmailSender", () => {
  it("sends sender-only replies when the original email has no CC recipients", async () => {
    const emailBinding = new MockSendEmail();
    const sender = new CloudflareEmailSender(
      "agent@caf-gpt.com",
      emailBinding as unknown as SendEmail,
      ["agent@caf-gpt.com", "pacenote@caf-gpt.com"],
      { authorizedDomains: ["forces.gc.ca"], authorizedEmails: ["luffy@luffy.email"] }
    );

    const result = await sender.sendReply(
      createMockParsedEmail({
        from: "sender@forces.gc.ca",
        cc: [],
        subject: "Leave question",
      }),
      { text: "Plain reply", html: "<p>HTML reply</p>" },
      { inReplyTo: "<source@forces.gc.ca>", references: "<source@forces.gc.ca>" }
    );

    expect(result.id).toBe("mock-email-1");
    expect(emailBinding.sentMessages[0]).toEqual({
      to: "sender@forces.gc.ca",
      from: { email: "agent@caf-gpt.com", name: "CAF-GPT" },
      replyTo: "agent@caf-gpt.com",
      subject: "Re: Leave question",
      text: "Plain reply",
      html: "<p>HTML reply</p>",
      headers: {
        "In-Reply-To": "<source@forces.gc.ca>",
        References: "<source@forces.gc.ca>",
      },
    });
  });

  it("adds safe original CC recipients for reply-all behavior", async () => {
    const emailBinding = new MockSendEmail();
    const sender = new CloudflareEmailSender(
      "agent@caf-gpt.com",
      emailBinding as unknown as SendEmail,
      ["agent@caf-gpt.com", "pacenote@caf-gpt.com"],
      { authorizedDomains: ["forces.gc.ca"], authorizedEmails: ["luffy@luffy.email"] }
    );

    await sender.sendReply(
      createMockParsedEmail({
        from: "sender@forces.gc.ca",
        cc: [
          "teammate@forces.gc.ca",
          "agent@caf-gpt.com",
          "pacenote@caf-gpt.com",
          "sender@forces.gc.ca",
          "Teammate@forces.gc.ca",
          "civilian@example.com",
          "luffy@luffy.email",
        ],
      }),
      { text: "Plain reply", html: "<p>HTML reply</p>" },
      {}
    );

    expect(emailBinding.sentMessages[0]).toMatchObject({
      to: "sender@forces.gc.ca",
      cc: ["teammate@forces.gc.ca", "luffy@luffy.email"],
    });
  });

  it("omits CC entirely when all original CC recipients are unauthorized", async () => {
    const emailBinding = new MockSendEmail();
    const sender = new CloudflareEmailSender(
      "agent@caf-gpt.com",
      emailBinding as unknown as SendEmail,
      ["agent@caf-gpt.com"],
      { authorizedDomains: ["forces.gc.ca"], authorizedEmails: [] }
    );

    await sender.sendReply(
      createMockParsedEmail({
        from: "sender@forces.gc.ca",
        cc: ["external@example.com"],
      }),
      { text: "Plain reply", html: "<p>HTML reply</p>" },
      {}
    );

    expect(emailBinding.sentMessages[0]).not.toHaveProperty("cc");
  });

  it("keeps error responses sender-only", async () => {
    const emailBinding = new MockSendEmail();
    const sender = new CloudflareEmailSender(
      "agent@caf-gpt.com",
      emailBinding as unknown as SendEmail,
      ["agent@caf-gpt.com"],
      { authorizedDomains: ["forces.gc.ca"], authorizedEmails: [] }
    );

    await sender.sendErrorResponse(
      createMockParsedEmail({
        from: "sender@forces.gc.ca",
        cc: ["teammate@forces.gc.ca"],
      }),
      "Something failed.",
      { inReplyTo: "<source@forces.gc.ca>" }
    );

    expect(emailBinding.sentMessages[0]).toEqual({
      to: "sender@forces.gc.ca",
      from: { email: "agent@caf-gpt.com", name: "CAF-GPT" },
      replyTo: "agent@caf-gpt.com",
      subject: "Error Processing Email",
      text: "Something failed.",
      headers: {
        "In-Reply-To": "<source@forces.gc.ca>",
      },
    });
  });
});
