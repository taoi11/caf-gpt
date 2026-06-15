/**
 * tests/unit/InboundReplyComposer.test.ts
 *
 * Unit tests for inbound Email Worker raw MIME reply composition.
 *
 * Top-level declarations:
 * - InboundReplyComposer test suite: Verifies signed text and multipart MIME output
 */

import { describe, expect, it } from "vitest";
import { InboundReplyComposer } from "../../src/email/components";

describe("InboundReplyComposer", () => {
  it("builds a signed text/plain reply", async () => {
    const composer = new InboundReplyComposer();

    const raw = await composer.composeRawReply(
      {
        fromAddress: "agent@caf-gpt.com",
        toAddress: "sender@forces.gc.ca",
        subject: "Re: Test",
        text: "Reply body\nSecond line",
        threadingOptions: {
          inReplyTo: "<original@forces.gc.ca>",
          headers: { References: "<root@forces.gc.ca> <original@forces.gc.ca>" },
        },
      },
      { secret: "test-secret", agentName: "user-agent", agentId: "sender%40forces.gc.ca" }
    );

    expect(raw).toContain('From: "CAF-GPT" <agent@caf-gpt.com>');
    expect(raw).toContain("To: <sender@forces.gc.ca>");
    expect(raw).toContain("Subject: Re: Test");
    expect(raw).toContain("In-Reply-To: <original@forces.gc.ca>");
    expect(raw).toContain("References: <root@forces.gc.ca> <original@forces.gc.ca>");
    expect(raw).toContain("X-Agent-Name: user-agent");
    expect(raw).toContain("X-Agent-ID: sender%40forces.gc.ca");
    expect(raw).toContain("X-Agent-Sig:");
    expect(raw).toContain("Content-Type: text/plain; charset=utf-8");
    expect(raw).toContain("Reply body\r\nSecond line");
  });

  it("builds multipart/alternative when HTML content is present", async () => {
    const composer = new InboundReplyComposer();

    const raw = await composer.composeRawReply(
      {
        fromAddress: "pacenote@caf-gpt.com",
        toAddress: "sender@forces.gc.ca",
        subject: "Re: Feedback",
        text: "Plain response",
        html: "<p>HTML response</p>",
        threadingOptions: {},
      },
      { secret: "test-secret", agentName: "user-agent", agentId: "sender%40forces.gc.ca" }
    );

    expect(raw).toContain('From: "CAF-GPT" <pacenote@caf-gpt.com>');
    expect(raw).toContain("Content-Type: multipart/alternative;");
    expect(raw).toContain("Content-Type: text/plain; charset=utf-8");
    expect(raw).toContain("Content-Type: text/html; charset=utf-8");
    expect(raw).toContain("Plain response");
    expect(raw).toContain("<p>HTML response</p>");
  });
});
