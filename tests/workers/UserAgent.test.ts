/**
 * tests/workers/UserAgent.test.ts
 *
 * Workers runtime integration tests for the UserAgent Durable Object on the Resend Inboxes path
 *
 * Top-level declarations:
 * - UserAgent inbound suite: Verifies receiveResendEmail dedupe by Resend email id and the
 *   claim release when scheduling fails
 * - UserAgent processing suite: Verifies the Resend call sequence, the thread reply request
 *   (subject, cc, Thread-Index/Thread-Topic, no In-Reply-To/References, Idempotency-Key), the
 *   sender-authentication and monitored-inbox gates, sender-only error replies, memory timing,
 *   Outlook-style quoted history (signature above the quote, chain carried forward, fail-loud on
 *   a missing Date), the Sent: offset learned from the user's own quote of our reply (including
 *   a Message-ID Resend reports late), and DO-stored thread context
 * - getUserAgentStub: Gets a per-sender UserAgent Durable Object stub
 * - mockPrimeFoo: Replaces Prime Foo processing through its public method contract
 * - mockSuccessfulSchedule: Replaces durable scheduling with a faithful delayed schedule
 */

/// <reference types="@cloudflare/vitest-pool-workers/types" />

import { reset, runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AgentCoordinator } from "../../src/agents/AgentCoordinator";
import { MemoryFooAgent } from "../../src/agents/sub-agents";
import { getUserAgentId, type UserAgent } from "../../src/agents/UserAgent";
import { createInboundEmail, type InboundEmailOptions, installResendMock } from "./resendHarness";

const mockGenerateText = vi.fn();

beforeEach(() => {
  const createCoordinator = AgentCoordinator.create;
  vi.spyOn(AgentCoordinator, "create").mockImplementation((testEnv, config) =>
    createCoordinator(testEnv, config, { generateText: mockGenerateText })
  );
});

afterEach(async () => {
  mockGenerateText.mockReset();
  vi.restoreAllMocks();
  await reset();
});

describe("UserAgent inbound acceptance", () => {
  it("schedules a new Resend email once and ignores repeated webhook deliveries", async () => {
    const sender = "dedupe@forces.gc.ca";

    const result = await runInDurableObject(getUserAgentStub(sender), async (instance) => {
      const schedule = mockSuccessfulSchedule(instance, "process-1");
      // SAFETY: scheduleEvery resolves a Schedule; UserAgent ignores it, and the fixture is a complete one.
      vi.spyOn(instance, "scheduleEvery").mockResolvedValue(createMockSchedule("prune") as never);

      const email = createInboundEmail({
        envelopeFrom: sender,
        envelopeTo: "agent@caf-gpt.com",
        from: sender,
        to: ["agent@caf-gpt.com"],
        subject: "Duplicate",
        body: "Same delivery",
        resendEmailId: "dedupe-email-1",
      });

      const first = await instance.receiveResendEmail(email.task);
      const second = await instance.receiveResendEmail(email.task);

      return { first, second, schedules: schedule.mock.calls };
    });

    expect(result.first).toBe("accepted");
    expect(result.second).toBe("duplicate");
    expect(result.schedules).toHaveLength(1);
    expect(result.schedules[0]).toEqual([
      0,
      "processResendEmail",
      expect.objectContaining({ emailId: "dedupe-email-1", inboxId: "inbox-agent" }),
      { retry: { maxAttempts: 1 } },
    ]);
  });

  it("releases the claim when scheduling fails so Resend's retry is processed", async () => {
    const sender = "claim-release@forces.gc.ca";

    const result = await runInDurableObject(getUserAgentStub(sender), async (instance) => {
      // SAFETY: scheduleEvery resolves a Schedule; UserAgent ignores it, and the fixture is a complete one.
      vi.spyOn(instance, "scheduleEvery").mockResolvedValue(createMockSchedule("prune") as never);

      const schedule = vi
        .spyOn(instance, "schedule")
        .mockRejectedValueOnce(new Error("schedule unavailable"));

      // SAFETY: Vitest erases the generic schedule result to never; the fixture is a complete one.
      schedule.mockResolvedValue(createMockSchedule("process-1") as never);

      const email = createInboundEmail({
        envelopeFrom: sender,
        envelopeTo: "agent@caf-gpt.com",
        from: sender,
        to: ["agent@caf-gpt.com"],
        subject: "Retry",
        body: "Body",
      });

      const firstError = await instance.receiveResendEmail(email.task).then(
        () => "resolved",
        () => "rejected"
      );

      const retry = await instance.receiveResendEmail(email.task);

      return { firstError, retry };
    });

    expect(result).toEqual({ firstError: "rejected", retry: "accepted" });
  });
});

describe("UserAgent email processing", () => {
  it("fetches the email from Resend and replies on its thread with reply-all cc", async () => {
    const sender = "test@forces.gc.ca";

    const result = await runInDurableObject(getUserAgentStub(sender), async (instance) => {
      const resend = installResendMock();

      const processWithPrimeFoo = vi.fn<AgentCoordinator["processWithPrimeFoo"]>(
        async (_context, memory) => ({
          shouldRespond: true,
          content: "<p>AI response</p>",
          memory,
        })
      );

      const email = createInboundEmail({
        envelopeFrom: sender,
        envelopeTo: "agent@caf-gpt.com",
        from: `Test Member <${sender}>`,
        replyTo: ["TEST@forces.gc.ca", "outside@example.com"],
        to: ["agent@caf-gpt.com", "test@forces.gc.ca", "ally@forces.gc.ca"],
        cc: ["external@example.com", "not-an-address", "ALLY@forces.gc.ca", "second@forces.gc.ca"],
        bcc: ["hidden@forces.gc.ca"],
        subject: "Leave question",
        body: "Can I take annual leave next week?",
        messageId: "<msg-1@forces.gc.ca>",
        headers: {
          references: "<root@forces.gc.ca> <msg-1@forces.gc.ca> <parent@forces.gc.ca>",
        },
      });

      instance.setState({ memory: "remembered preference", versions: [] });
      const schedule = mockSuccessfulSchedule(instance, "schedule-1");
      mockPrimeFoo(processWithPrimeFoo);

      await resend.deliver(instance, email);

      return {
        emailId: email.task.emailId,
        requests: resend.requests,
        replies: resend.replies,
        schedules: schedule.mock.calls,
        primeFooCalls: processWithPrimeFoo.mock.calls,
      };
    });

    const id = result.emailId;
    expect(result.requests.slice(0, 4)).toEqual([
      "GET /inboxes/inbox-agent",
      `GET /emails/receiving/${id}`,
      `GET https://raw.resend.test/${id}`,
      `POST /inboxes/inbox-agent/threads/thread-${id}/emails/${id}/reply`,
    ]);
    // Then the sent Message-ID lookup for the reply.
    expect(result.requests[4]).toMatch(/^GET \/emails\/reply-\d+$/);
    expect(result.primeFooCalls[0][1]).toBe("remembered preference");
    expect(result.primeFooCalls[0][0]).toContain("Authenticated-Sender: test@forces.gc.ca");
    expect(result.replies).toHaveLength(1);
    expect(result.replies[0].idempotencyKey).toBe(`caf-gpt-reply/${id}`);
    expect(result.replies[0].body).toMatchObject({
      subject: "Re: Leave question",
      reply_all: false,
      // Resend sends To = Reply-To (test@, outside@); cc carries the rest of reply-all.
      cc: ["ally@forces.gc.ca", "external@example.com", "second@forces.gc.ca"],
    });
    expect(result.replies[0].body.headers).toBeUndefined();
    const serialized = JSON.stringify(result.replies[0].body);
    expect(serialized).not.toContain("hidden@forces.gc.ca");
    expect(serialized).not.toContain("In-Reply-To");
    expect(serialized).not.toContain("References");
    expect(serialized).not.toContain("Message-ID");
    expect(result.schedules).toEqual([
      [
        1,
        "runMemoryUpdate",
        {
          emailContext: result.primeFooCalls[0][0],
          agentReply: "<p>AI response</p>",
        },
        { retry: { maxAttempts: 3 }, idempotent: true },
      ],
    ]);
  });

  it("moves policy To mailboxes that Resend's reply will not reach into Cc", async () => {
    const sender = "cc-fallback@forces.gc.ca";

    const result = await runInDurableObject(getUserAgentStub(sender), async (instance) => {
      const resend = installResendMock();
      const warnings = vi.spyOn(console, "warn").mockImplementation(() => undefined);

      mockSuccessfulSchedule(instance, "schedule-1");
      mockPrimeFoo(vi.fn(async () => ({ shouldRespond: true, content: "<p>Answer</p>" })));

      // Policy drops CAF-GPT Reply-To mailboxes and falls back to From, but Resend still sends
      // To the Reply-To, so the sender would be missed unless it moves to Cc.
      await resend.deliver(
        instance,
        createInboundEmail({
          envelopeFrom: sender,
          envelopeTo: "agent@caf-gpt.com",
          from: `CC Fallback <${sender}>`,
          replyTo: ["agent@caf-gpt.com"],
          to: ["agent@caf-gpt.com", "ally@forces.gc.ca"],
          subject: "Cc fallback",
          body: "Question",
          messageId: "<cc-fallback@forces.gc.ca>",
        })
      );

      return {
        replies: resend.replies,
        warnings: warnings.mock.calls.map(([payload]) => JSON.stringify(payload)),
      };
    });

    expect(result.replies).toHaveLength(1);
    expect(result.replies[0].body.cc).toEqual([sender, "ally@forces.gc.ca"]);
    expect(result.replies[0].body.reply_all).toBe(false);

    const mismatch = result.warnings.find((line) =>
      line.includes("Reply To set by Resend differs from recipient policy")
    );

    expect(mismatch).toBeDefined();
    expect(mismatch).toContain('"policyToCount":1');
    expect(mismatch).toContain('"resendToCount":1');
    expect(mismatch).not.toContain(sender);
  });

  it("swallows rejected memory scheduling after a successful reply", async () => {
    const sender = "schedule-failure@forces.gc.ca";

    const result = await runInDurableObject(getUserAgentStub(sender), async (instance) => {
      const resend = installResendMock();

      const schedule = vi
        .spyOn(instance, "schedule")
        .mockRejectedValue(new Error("schedule unavailable"));

      mockPrimeFoo(vi.fn(async () => ({ shouldRespond: true, content: "Response" })));

      await expect(
        resend.deliver(
          instance,
          createInboundEmail({
            envelopeFrom: sender,
            envelopeTo: "agent@caf-gpt.com",
            from: sender,
            to: ["agent@caf-gpt.com"],
            subject: "Question",
            body: "Body",
            messageId: "<schedule-failure@forces.gc.ca>",
          })
        )
      ).resolves.toBeUndefined();

      return { sends: resend.replies.length, schedules: schedule.mock.calls.length };
    });

    expect(result).toEqual({ sends: 1, schedules: 1 });
  });

  it("uses the pacenote inbox for the reply thread and AI context", async () => {
    const sender = "pacenote-user@forces.gc.ca";

    const result = await runInDurableObject(getUserAgentStub(sender), async (instance) => {
      const resend = installResendMock();

      const processWithPrimeFoo = vi.fn<AgentCoordinator["processWithPrimeFoo"]>(async () => ({
        shouldRespond: true,
        content: "<p>Feedback note</p>",
      }));

      mockSuccessfulSchedule(instance, "schedule-1");
      mockPrimeFoo(processWithPrimeFoo);

      await resend.deliver(
        instance,
        createInboundEmail({
          envelopeFrom: sender,
          envelopeTo: "pacenote@caf-gpt.com",
          from: sender,
          to: ["forwarder@forces.gc.ca"],
          subject: "Feedback note",
          body: "Write a feedback note.",
          messageId: "<pacenote-1@forces.gc.ca>",
        })
      );

      return { replies: resend.replies, primeFooCalls: processWithPrimeFoo.mock.calls };
    });

    expect(result.primeFooCalls[0][0]).toContain("Envelope-To: pacenote@caf-gpt.com");
    expect(result.primeFooCalls[0][0]).toContain("To: forwarder@forces.gc.ca");
    expect(result.replies[0].path).toMatch(/^\/inboxes\/inbox-pacenote\/threads\//);
    expect(result.replies[0].body.cc).toEqual(["forwarder@forces.gc.ca"]);
  });

  it("skips an inbox that is not monitored before reading the email", async () => {
    const sender = "unmonitored@forces.gc.ca";

    const result = await runInDurableObject(getUserAgentStub(sender), async (instance) => {
      const resend = installResendMock();
      const processWithPrimeFoo = vi.fn<AgentCoordinator["processWithPrimeFoo"]>();
      mockPrimeFoo(processWithPrimeFoo);

      await resend.deliver(
        instance,
        createInboundEmail({
          envelopeFrom: sender,
          envelopeTo: "other@caf-gpt.com",
          from: sender,
          to: ["other@caf-gpt.com"],
          subject: "Hello",
          body: "Body",
        })
      );

      return { requests: resend.requests, replies: resend.replies.length };
    });

    expect(result).toEqual({ requests: ["GET /inboxes/inbox-other"], replies: 0 });
  });

  it.each([
    ["failed DMARC and DKIM", { spf: "pass", dkim: "fail", dmarc: "fail" }],
    ["missing authentication results", null],
  ])("drops mail with %s without AI work, raw download, or a reply", async (_label, auth) => {
    const sender = "spoofed@forces.gc.ca";

    const result = await runInDurableObject(getUserAgentStub(sender), async (instance) => {
      const resend = installResendMock();
      const processWithPrimeFoo = vi.fn<AgentCoordinator["processWithPrimeFoo"]>();
      mockPrimeFoo(processWithPrimeFoo);

      await resend.deliver(
        instance,
        createInboundEmail({
          envelopeFrom: sender,
          envelopeTo: "agent@caf-gpt.com",
          from: sender,
          to: ["agent@caf-gpt.com"],
          subject: "Hello",
          body: "",
          authentication: auth,
        })
      );

      return {
        aiCalls: processWithPrimeFoo.mock.calls.length,
        rawDownloads: resend.requests.filter((entry) => entry.includes("raw.resend.test")).length,
        replies: resend.replies.length,
      };
    });

    expect(result).toEqual({ aiCalls: 0, rawDownloads: 0, replies: 0 });
  });

  it("adds a child Thread-Index and Thread-Topic so Exchange groups the reply", async () => {
    const sender = "outlook-thread@forces.gc.ca";

    const parentIndex = btoa(
      String.fromCharCode(
        0x01,
        0x01,
        0xdc,
        0x41,
        0x2a,
        0x7b,
        ...Array.from({ length: 16 }, () => 0x42)
      )
    );

    const reply = await runInDurableObject(getUserAgentStub(sender), async (instance) => {
      const resend = installResendMock();
      mockSuccessfulSchedule(instance, "schedule-1");
      mockPrimeFoo(vi.fn(async () => ({ shouldRespond: true, content: "Response" })));

      await resend.deliver(
        instance,
        createInboundEmail({
          envelopeFrom: sender,
          envelopeTo: "agent@caf-gpt.com",
          from: sender,
          to: ["agent@caf-gpt.com"],
          subject: "feedback note please",
          body: "Body",
          messageId: "<outlook-original@forces.gc.ca>",
          headers: { "thread-index": parentIndex, "thread-topic": "feedback note please" },
        })
      );

      return resend.replies[0].body;
    });

    const childIndex = atob(reply.headers?.["Thread-Index"] ?? "");
    expect(childIndex).toHaveLength(27);
    expect(childIndex.slice(0, 22)).toBe(atob(parentIndex));
    // Resend sets In-Reply-To/References itself and rejects them as custom headers.
    expect(reply.headers).toEqual({
      "Thread-Index": reply.headers?.["Thread-Index"],
      "Thread-Topic": "feedback note please",
    });
  });

  it("quotes the inbound email below the answer and signature in Outlook's layout", async () => {
    const sender = "quote-layout@forces.gc.ca";

    const signature =
      '<div class="MsoNormal">\n<br><br>\nCAF-GPT<br>\nSource Code:<br>\n<pre><code>https://github.com/taoi11/caf-gpt</code></pre>\nHow to use CAF-GPT:<br>\n<pre><code>https://caf-gpt.com</code></pre>\n</div>';

    const delivered = await runInDurableObject(getUserAgentStub(sender), async (instance) => {
      const resend = installResendMock();
      mockSuccessfulSchedule(instance, "schedule-1");
      mockPrimeFoo(
        vi.fn(async () => ({
          shouldRespond: true,
          content: `<p>Here is your note.</p>\n${signature}`,
        }))
      );

      await resend.deliver(
        instance,
        createInboundEmail({
          envelopeFrom: sender,
          envelopeTo: "agent@caf-gpt.com",
          from: `"Dhaliwal, MCpl Luffy" <${sender}>`,
          to: ["CAF-GPT <agent@caf-gpt.com>"],
          cc: ["Ally Person <ally@forces.gc.ca>"],
          subject: "RE: Re: Feedback note for Cpl Example",
          body: "Original request narrative UNIQUE-ORIGINAL-BODY",
          date: "Wed, 28 Oct 2026 17:29:00 +0000",
          messageId: "<current@forces.gc.ca>",
          headers: {
            references: "<root@forces.gc.ca> <parent@forces.gc.ca>",
            "in-reply-to": "<parent@forces.gc.ca>",
          },
        })
      );

      return resend.replies[0].body;
    });

    expect(delivered.subject).toBe("Re: Feedback note for Cpl Example");
    expect(delivered.headers).toBeUndefined();
    const text = delivered.text ?? "";
    expect(text).toContain(
      [
        "________________________________",
        `From: Dhaliwal, MCpl Luffy <${sender}>`,
        "Sent: October 28, 2026 11:29 AM",
        "To: CAF-GPT <agent@caf-gpt.com>",
        "Cc: Ally Person <ally@forces.gc.ca>",
        "Subject: RE: Re: Feedback note for Cpl Example",
        "",
        "Original request narrative UNIQUE-ORIGINAL-BODY",
      ].join("\n")
    );
    expect(text.indexOf("Here is your note.")).toBeLessThan(text.indexOf("How to use CAF-GPT:"));
    expect(text.indexOf("How to use CAF-GPT:")).toBeLessThan(text.indexOf("________________"));

    const html = delivered.html ?? "";
    expect(html).toContain(
      `<b>From:</b> Dhaliwal, MCpl Luffy &lt;${sender}&gt;<br>\n<b>Sent:</b> October 28, 2026 11:29 AM<br>\n<b>To:</b> CAF-GPT &lt;agent@caf-gpt.com&gt;<br>\n<b>Cc:</b> Ally Person &lt;ally@forces.gc.ca&gt;<br>\n<b>Subject:</b> RE: Re: Feedback note for Cpl Example</p>`
    );
    expect(html).toContain(
      "<p class=MsoNormal>Original request narrative UNIQUE-ORIGINAL-BODY</p>"
    );
    expect(html.indexOf("How to use CAF-GPT:")).toBeLessThan(
      html.indexOf("border-top:solid #E1E1E1 1.0pt")
    );
    expect(html.indexOf("border-top:solid #E1E1E1 1.0pt")).toBeLessThan(
      html.indexOf("UNIQUE-ORIGINAL-BODY")
    );
  });

  it("learns the Sent: offset from the user's quote of our reply, saves it, and reuses it", async () => {
    const sender = "sent-offset@forces.gc.ca";
    const stub = getUserAgentStub(sender);

    const runTurn = (nowIso: string, outboundId: string, fields: Partial<InboundEmailOptions>) =>
      runInDurableObject(stub, async (instance: UserAgent) => {
        vi.spyOn(Date, "now").mockReturnValue(Date.parse(nowIso));
        const resend = installResendMock({ sentMessageId: () => outboundId });
        mockSuccessfulSchedule(instance, "schedule-1");
        // SAFETY: scheduleEvery resolves a Schedule; UserAgent ignores it, and the fixture is a complete one.
        vi.spyOn(instance, "scheduleEvery").mockResolvedValue(createMockSchedule("prune") as never);
        mockPrimeFoo(vi.fn(async () => ({ shouldRespond: true, content: "<p>Ok</p>" })));
        await resend.deliver(
          instance,
          createInboundEmail({
            envelopeFrom: sender,
            envelopeTo: "agent@caf-gpt.com",
            from: sender,
            to: ["CAF-GPT <agent@caf-gpt.com>"],
            subject: "Leave",
            body: "First question",
            ...fields,
          })
        );

        const stored = instance.sql<{ message_id: string; sent_at: number }>`
          SELECT message_id, sent_at FROM cafgpt_reply_sent_times ORDER BY sent_at`;

        const offset = instance.sql<{ offset_minutes: number }>`
          SELECT offset_minutes FROM cafgpt_sent_offset`;

        const message = resend.replies.at(-1)?.body;

        return {
          text: message?.text ?? "",
          html: message?.html ?? "",
          stored,
          offset: offset[0]?.offset_minutes,
        };
      });

    // First email, nothing learned: America/Edmonton (17:29Z = 11:29 AM MDT).
    const first = await runTurn("2026-10-28T17:30:10Z", "<reply1@caf-gpt.com>", {
      messageId: "<q1@forces.gc.ca>",
      date: "Wed, 28 Oct 2026 17:29:00 +0000",
    });

    expect(first.text).toContain("Sent: October 28, 2026 11:29 AM");
    expect(first.stored).toEqual([
      { message_id: "<reply1@caf-gpt.com>", sent_at: Date.parse("2026-10-28T17:30:10Z") },
    ]);
    expect(first.offset).toBeUndefined();

    // The user's PC is on UTC-3: Outlook quoted our 17:30Z reply as 2:30 PM (HTML part only).
    const second = await runTurn("2026-10-28T17:46:00Z", "<reply2@caf-gpt.com>", {
      messageId: "<q2@forces.gc.ca>",
      date: "Wed, 28 Oct 2026 17:45:00 +0000",
      body: "Thanks",
      html: buildQuotedReplyHtml("2:30 PM"),
      headers: {
        "in-reply-to": "<reply1@caf-gpt.com>",
        references: "<q1@forces.gc.ca> <reply1@caf-gpt.com>",
      },
    });

    expect(second.text).toContain("Sent: October 28, 2026 2:45 PM");
    expect(second.html).toContain("<b>Sent:</b> October 28, 2026 2:45 PM<br>");
    expect(second.offset).toBe(-180);
    expect(second.stored).toHaveLength(2);

    // A new thread with no CAF-GPT quote reuses the saved offset instead of Edmonton.
    const third = await runTurn("2026-10-28T18:01:00Z", "<reply3@caf-gpt.com>", {
      messageId: "<q3@forces.gc.ca>",
      date: "Wed, 28 Oct 2026 18:00:00 +0000",
      body: "New question",
    });

    expect(third.text).toContain("Sent: October 28, 2026 3:00 PM");

    // Send times and the saved offset follow ThreadHistory's 30-day retention.
    const expired = await runInDurableObject(stub, async (instance: UserAgent) => {
      vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-28T18:02:00Z"));
      await instance.runThreadHistoryPrune(undefined, { id: "missing" });

      return {
        times: instance.sql<{
          count: number;
        }>`SELECT COUNT(*) AS count FROM cafgpt_reply_sent_times`[0].count,
        offsets: instance.sql<{
          count: number;
        }>`SELECT COUNT(*) AS count FROM cafgpt_sent_offset`[0].count,
      };
    });

    expect(expired).toEqual({ times: 0, offsets: 0 });
  });

  it("keeps a send time pending until Resend reports the reply's Message-ID", async () => {
    const sender = "pending-sent@forces.gc.ca";
    const stub = getUserAgentStub(sender);

    const first = await runInDurableObject(stub, async (instance: UserAgent) => {
      vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-28T17:30:10Z"));
      const resend = installResendMock({ sentMessageId: () => null });
      mockSuccessfulSchedule(instance, "schedule-1");
      mockPrimeFoo(vi.fn(async () => ({ shouldRespond: true, content: "<p>Ok</p>" })));
      await resend.deliver(
        instance,
        createInboundEmail({
          envelopeFrom: sender,
          envelopeTo: "agent@caf-gpt.com",
          from: sender,
          to: ["CAF-GPT <agent@caf-gpt.com>"],
          subject: "Leave",
          body: "PENDING-FIRST-ASK",
          messageId: "<p1@forces.gc.ca>",
          date: "Wed, 28 Oct 2026 17:29:00 +0000",
        })
      );

      return {
        replyId: resend.replyIds[0],
        pending: instance.sql<{
          count: number;
        }>`SELECT COUNT(*) AS count FROM cafgpt_pending_sent_times`[0].count,
      };
    });

    expect(first.pending).toBe(1);

    const second = await runInDurableObject(stub, async (instance: UserAgent) => {
      vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-28T17:46:00Z"));

      const resend = installResendMock({
        sentMessageId: (id) => (id === first.replyId ? "<late1@caf-gpt.com>" : `<${id}@caf-gpt>`),
      });

      mockSuccessfulSchedule(instance, "schedule-1");

      const primeFoo = vi.fn<AgentCoordinator["processWithPrimeFoo"]>(async () => ({
        shouldRespond: true,
        content: "<p>Ok</p>",
      }));

      mockPrimeFoo(primeFoo);
      await resend.deliver(
        instance,
        createInboundEmail({
          envelopeFrom: sender,
          envelopeTo: "agent@caf-gpt.com",
          from: sender,
          to: ["CAF-GPT <agent@caf-gpt.com>"],
          subject: "RE: Leave",
          body: "Thanks",
          html: buildQuotedReplyHtml("2:30 PM"),
          messageId: "<p2@forces.gc.ca>",
          date: "Wed, 28 Oct 2026 17:45:00 +0000",
          headers: { "in-reply-to": "<late1@caf-gpt.com>" },
        })
      );

      return {
        context: primeFoo.mock.calls[0][0],
        offset: instance.sql<{
          offset_minutes: number;
        }>`SELECT offset_minutes FROM cafgpt_sent_offset`[0]?.offset_minutes,
        pending: instance.sql<{
          count: number;
        }>`SELECT COUNT(*) AS count FROM cafgpt_pending_sent_times`[0].count,
      };
    });

    // The late Message-ID resolves the send time and links the thread for In-Reply-To matching.
    expect(second.offset).toBe(-180);
    expect(second.pending).toBe(0);
    expect(second.context).toContain("PENDING-FIRST-ASK");
  });

  it("carries a multi-level Outlook chain forward from the inbound HTML body", async () => {
    const sender = "quote-chain@forces.gc.ca";

    const inboundHtml = [
      "<html><head><style>p{color:red}</style></head><body>",
      "<p class=MsoNormal>LEVEL-3 newest ask<o:p></o:p></p>",
      "<div style='border:none;border-top:solid #E1E1E1 1.0pt;padding:3.0pt 0cm 0cm 0cm'>",
      "<p class=MsoNormal><b>From:</b> CAF-GPT &lt;agent@caf-gpt.com&gt;<br><b>Sent:</b> October 27, 2026 9:00 AM<br><b>Subject:</b> Re: chain</p></div>",
      "<p class=MsoNormal>LEVEL-2 our earlier answer</p>",
      "<div style='border:none;border-top:solid #E1E1E1 1.0pt;padding:3.0pt 0cm 0cm 0cm'>",
      "<p class=MsoNormal><b>From:</b> Member &lt;member@forces.gc.ca&gt;<br><b>Sent:</b> October 26, 2026 8:00 AM<br><b>Subject:</b> chain</p></div>",
      "<p class=MsoNormal>LEVEL-1 original ask</p>",
      '<script>alert("x")</script><img src="x" onerror="alert(1)">',
      "</body></html>",
    ].join("\n");

    const delivered = await runInDurableObject(getUserAgentStub(sender), async (instance) => {
      const resend = installResendMock();
      mockSuccessfulSchedule(instance, "schedule-1");
      mockPrimeFoo(vi.fn(async () => ({ shouldRespond: true, content: "<p>LEVEL-4 answer</p>" })));

      await resend.deliver(
        instance,
        createInboundEmail({
          envelopeFrom: sender,
          envelopeTo: "agent@caf-gpt.com",
          from: sender,
          to: ["agent@caf-gpt.com"],
          subject: "RE: Re: chain",
          body: "LEVEL-3 newest ask\n\nFrom: CAF-GPT\nLEVEL-2 our earlier answer\n\nLEVEL-1 original ask",
          html: inboundHtml,
          messageId: "<chain-3@forces.gc.ca>",
        })
      );

      return resend.replies[0].body;
    });

    const html = delivered.html ?? "";

    const order = ["LEVEL-4", "LEVEL-3", "LEVEL-2", "LEVEL-1"].map((marker) =>
      html.indexOf(marker)
    );

    expect(order.every((position) => position >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    // Our new header block plus the two carried-forward blocks.
    expect(html.match(/border-top:solid #E1E1E1 1\.0pt/g)).toHaveLength(3);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("color:red");
    expect(html.match(/<html/g)).toHaveLength(1);
    expect(html.match(/<\/body>/g)).toHaveLength(1);
    const text = delivered.text;
    expect(text.indexOf("LEVEL-4")).toBeLessThan(text.indexOf("Subject: RE: Re: chain"));
    expect(text.indexOf("LEVEL-3")).toBeLessThan(text.indexOf("LEVEL-1"));
  });

  it("fails loudly with the funny error reply instead of sending without the quote", async () => {
    const sender = "quote-fail@forces.gc.ca";

    const result = await runInDurableObject(getUserAgentStub(sender), async (instance) => {
      const resend = installResendMock();
      mockSuccessfulSchedule(instance, "schedule-1");
      mockPrimeFoo(vi.fn(async () => ({ shouldRespond: true, content: "<p>UNQUOTED-ANSWER</p>" })));

      const email = createInboundEmail({
        envelopeFrom: sender,
        envelopeTo: "agent@caf-gpt.com",
        from: sender,
        to: ["agent@caf-gpt.com"],
        subject: "No date",
        body: "Body",
        date: null,
        messageId: "<no-date@forces.gc.ca>",
      });

      await resend.deliver(instance, email);

      return { replies: resend.replies, emailId: email.task.emailId };
    });

    expect(result.replies).toHaveLength(1);
    expect(result.replies[0].idempotencyKey).toBe(`caf-gpt-error/${result.emailId}`);
    expect(result.replies[0].body).toMatchObject({
      subject: "Error Processing Email",
      reply_all: false,
    });
    expect(result.replies[0].body.text).toContain(
      "I tried to write a reply and face-planted. Classic me."
    );
    expect(JSON.stringify(result.replies[0])).not.toContain("UNQUOTED-ANSWER");
  });

  it("keeps prior-turn context for Prime Foo on the user's next reply in the thread", async () => {
    const sender = "thread-memory@forces.gc.ca";

    const contexts = await runInDurableObject(getUserAgentStub(sender), async (instance) => {
      const resend = installResendMock();
      mockSuccessfulSchedule(instance, "schedule-1");

      const primeFoo = vi.fn<AgentCoordinator["processWithPrimeFoo"]>(async () => ({
        shouldRespond: true,
        content: "<p>What is the member's rank?</p>",
      }));

      mockPrimeFoo(primeFoo);

      const base = {
        envelopeFrom: sender,
        envelopeTo: "agent@caf-gpt.com",
        from: sender,
        to: ["agent@caf-gpt.com"],
      };

      await resend.deliver(
        instance,
        createInboundEmail({
          ...base,
          subject: "Feedback note",
          body: "Pte Smith led the vehicle recovery TURN-ONE-NARRATIVE",
          messageId: "<turn1@forces.gc.ca>",
        })
      );
      // Outlook's reply to our message: References keeps turn 1, In-Reply-To is our reply's id.
      await resend.deliver(
        instance,
        createInboundEmail({
          ...base,
          subject: "RE: Feedback note",
          body: "Sgt TURN-TWO-ANSWER",
          messageId: "<turn2@forces.gc.ca>",
          headers: {
            references: "<turn1@forces.gc.ca> <agent-reply-1@caf-gpt.com>",
            "in-reply-to": "<agent-reply-1@caf-gpt.com>",
          },
        })
      );
      await resend.deliver(
        instance,
        createInboundEmail({
          ...base,
          subject: "RE: Feedback note",
          body: "Make it shorter TURN-THREE",
          messageId: "<turn3@forces.gc.ca>",
          headers: {
            references:
              "<turn1@forces.gc.ca> <agent-reply-1@caf-gpt.com> <turn2@forces.gc.ca> <agent-reply-2@caf-gpt.com>",
            "in-reply-to": "<agent-reply-2@caf-gpt.com>",
          },
        })
      );
      await resend.deliver(
        instance,
        createInboundEmail({
          ...base,
          subject: "Unrelated",
          body: "New topic UNRELATED",
          messageId: "<other@forces.gc.ca>",
        })
      );

      return primeFoo.mock.calls.map((call) => call[0]);
    });

    expect(contexts).toHaveLength(4);
    expect(contexts[0]).not.toContain("________________________________");
    expect(contexts[1]).toContain("Sgt TURN-TWO-ANSWER");
    expect(contexts[1]).toContain("TURN-ONE-NARRATIVE");
    // Our previous reply is kept too, so a bare answer to our question still makes sense.
    expect(contexts[1]).toContain("What is the member's rank?");
    // Newest prior turn first, matching the nested order quoted history used.
    expect(contexts[2].indexOf("TURN-TWO-ANSWER")).toBeGreaterThan(-1);
    expect(contexts[2].indexOf("TURN-TWO-ANSWER")).toBeLessThan(
      contexts[2].indexOf("TURN-ONE-NARRATIVE")
    );
    expect(contexts[3]).not.toContain("TURN-ONE-NARRATIVE");
    expect(contexts[3]).not.toContain("TURN-TWO-ANSWER");
  });

  it("never matches another sender's thread, matches our outbound id, and drops expired turns", async () => {
    const owner = "thread-owner@forces.gc.ca";
    const other = "thread-other@forces.gc.ca";

    const runTurn = (sender: string, fields: Partial<InboundEmailOptions>) =>
      runInDurableObject(getUserAgentStub(sender), async (instance: UserAgent) => {
        const resend = installResendMock({ sentMessageId: () => `<out-${sender}>` });
        mockSuccessfulSchedule(instance, "schedule-1");

        const primeFoo = vi.fn<AgentCoordinator["processWithPrimeFoo"]>(async () => ({
          shouldRespond: true,
          content: "<p>Ok</p>",
        }));

        mockPrimeFoo(primeFoo);
        await resend.deliver(
          instance,
          createInboundEmail({
            envelopeFrom: sender,
            envelopeTo: "agent@caf-gpt.com",
            from: sender,
            to: ["agent@caf-gpt.com"],
            subject: "Thread",
            body: "Body",
            ...fields,
          })
        );

        return primeFoo.mock.calls[0][0];
      });

    await runTurn(owner, { body: "OWNER-SECRET", messageId: "<owner1@forces.gc.ca>" });

    // Forged References from another sender land in that sender's own DO: no match.
    const otherContext = await runTurn(other, {
      messageId: "<other1@forces.gc.ca>",
      headers: { references: "<owner1@forces.gc.ca>" },
    });

    expect(otherContext).not.toContain("OWNER-SECRET");

    // Ids with no separator still match the stored thread.
    const ownerContext = await runTurn(owner, {
      messageId: "<owner2@forces.gc.ca>",
      headers: { references: "<owner1@forces.gc.ca><agent-reply@caf-gpt.com>" },
    });

    expect(ownerContext).toContain("OWNER-SECRET");

    // A reply carrying only In-Reply-To = our outbound Message-ID still matches.
    const inReplyToOnly = await runTurn(owner, {
      messageId: "<owner3@forces.gc.ca>",
      headers: { "in-reply-to": `<out-${owner}>` },
    });

    expect(inReplyToOnly).toContain("OWNER-SECRET");

    // A very long answer cannot push the inbound email out of the stored turn.
    const longSender = "thread-long@forces.gc.ca";
    await runInDurableObject(getUserAgentStub(longSender), async (instance: UserAgent) => {
      const resend = installResendMock();
      mockSuccessfulSchedule(instance, "schedule-1");
      mockPrimeFoo(
        vi.fn(async () => ({ shouldRespond: true, content: `<p>${"x".repeat(30_000)}</p>` }))
      );
      await resend.deliver(
        instance,
        createInboundEmail({
          envelopeFrom: longSender,
          envelopeTo: "agent@caf-gpt.com",
          from: longSender,
          to: ["agent@caf-gpt.com"],
          subject: "Thread",
          body: "LONG-INBOUND-DETAIL",
          messageId: "<long1@forces.gc.ca>",
        })
      );
    });

    const longFollowUp = await runTurn(longSender, {
      messageId: "<long2@forces.gc.ca>",
      headers: { references: "<long1@forces.gc.ca>" },
    });

    expect(longFollowUp).toContain("LONG-INBOUND-DETAIL");

    // A first email with no usable ids is seeded from our outbound Message-ID.
    const noIdSender = "thread-noid@forces.gc.ca";
    await runTurn(noIdSender, { body: "NOID-FIRST", messageId: undefined });

    const noIdFollowUp = await runTurn(noIdSender, {
      messageId: "<noid2@forces.gc.ca>",
      headers: { "in-reply-to": `<out-${noIdSender}>` },
    });

    expect(noIdFollowUp).toContain("NOID-FIRST");

    // Nothing is stored when the prune schedule cannot be ensured.
    const unscheduled = await runInDurableObject(
      getUserAgentStub("thread-unscheduled@forces.gc.ca"),
      async (instance: UserAgent) => {
        const resend = installResendMock();
        mockSuccessfulSchedule(instance, "schedule-1");
        vi.spyOn(instance, "scheduleEvery").mockRejectedValue(new Error("schedule unavailable"));
        mockPrimeFoo(vi.fn(async () => ({ shouldRespond: true, content: "<p>Ok</p>" })));
        await resend.deliver(
          instance,
          createInboundEmail({
            envelopeFrom: "thread-unscheduled@forces.gc.ca",
            envelopeTo: "agent@caf-gpt.com",
            from: "thread-unscheduled@forces.gc.ca",
            to: ["agent@caf-gpt.com"],
            subject: "Thread",
            body: "Body",
            messageId: "<unscheduled@forces.gc.ca>",
          })
        );

        return instance.sql<{
          count: number;
        }>`SELECT COUNT(*) AS count FROM cafgpt_thread_turns`[0].count;
      }
    );

    expect(unscheduled).toBe(0);

    const expired = await runInDurableObject(
      getUserAgentStub(owner),
      async (instance: UserAgent) => {
        vi.spyOn(Date, "now").mockReturnValue(Date.now() + 31 * 24 * 60 * 60 * 1000);
        await instance.runThreadHistoryPrune(undefined, { id: "missing" });

        return instance.sql<{ count: number }>`SELECT COUNT(*) AS count FROM cafgpt_thread_turns`[0]
          .count;
      }
    );

    expect(expired).toBe(0);
  });

  it("treats blank real-coordinator output as an intentional no-response decision", async () => {
    const sender = "blank-output@forces.gc.ca";

    const replies = await runInDurableObject(getUserAgentStub(sender), async (instance) => {
      const resend = installResendMock();
      mockGenerateText.mockResolvedValueOnce({ text: "", steps: [] });

      await resend.deliver(
        instance,
        createInboundEmail({
          envelopeFrom: sender,
          envelopeTo: "agent@caf-gpt.com",
          from: sender,
          to: ["agent@caf-gpt.com", "ally@forces.gc.ca"],
          cc: ["second@forces.gc.ca"],
          subject: "Question",
          body: "Sensitive inbound body",
          messageId: "<blank-output@forces.gc.ca>",
        })
      );

      return resend.replies.length;
    });

    expect(replies).toBe(0);
  });

  it.each([
    "model",
    "storage",
  ])("routes real coordinator %s failures to one plain sender-only error reply", async (label) => {
    const sender = `${label}@forces.gc.ca`;

    const result = await runInDurableObject(getUserAgentStub(sender), async (instance) => {
      const resend = installResendMock();

      if (label === "model") {
        mockGenerateText.mockRejectedValueOnce(new Error("model down with sensitive content"));
      } else {
        mockGenerateText.mockImplementationOnce(async (options: PrimeCoordinatorCallOptions) => {
          await options.tools?.batch_research?.execute({
            leave_queries: ["Read unavailable policy storage"],
          });

          return { text: "must not be returned", steps: [] };
        });
      }

      const email = createInboundEmail({
        envelopeFrom: sender,
        envelopeTo: "agent@caf-gpt.com",
        from: sender,
        to: ["agent@caf-gpt.com", "ally@forces.gc.ca"],
        cc: ["second@forces.gc.ca"],
        subject: "Question",
        body: "Sensitive inbound body",
        messageId: `<${label}@forces.gc.ca>`,
      });

      await resend.deliver(instance, email);

      return { replies: resend.replies, emailId: email.task.emailId };
    });

    expect(result.replies).toHaveLength(1);
    const sent = result.replies[0];
    expect(sent.idempotencyKey).toBe(`caf-gpt-error/${result.emailId}`);
    expect(sent.body).toEqual({
      subject: "Error Processing Email",
      text: expect.any(String),
      reply_all: false,
    });
    expect(JSON.stringify(sent)).not.toContain("Sensitive inbound body");
    expect(JSON.stringify(sent)).not.toContain("ally@forces.gc.ca");
  });

  it("skips the error reply when Reply-To names another address", async () => {
    const sender = "reply-to-other@forces.gc.ca";

    const replies = await runInDurableObject(getUserAgentStub(sender), async (instance) => {
      const resend = installResendMock();
      mockPrimeFoo(vi.fn());

      await resend.deliver(
        instance,
        createInboundEmail({
          envelopeFrom: sender,
          envelopeTo: "agent@caf-gpt.com",
          from: sender,
          replyTo: ["victim@example.com"],
          to: ["agent@caf-gpt.com"],
          subject: "Empty",
          body: "",
        })
      );

      return resend.replies.length;
    });

    expect(replies).toBe(0);
  });

  it("resolves validation failures without AI work", async () => {
    const sender = "invalid@forces.gc.ca";

    const result = await runInDurableObject(getUserAgentStub(sender), async (instance) => {
      const resend = installResendMock();
      const processWithPrimeFoo = vi.fn<AgentCoordinator["processWithPrimeFoo"]>();
      mockPrimeFoo(processWithPrimeFoo);

      await resend.deliver(
        instance,
        createInboundEmail({
          envelopeFrom: sender,
          envelopeTo: "agent@caf-gpt.com",
          from: sender,
          to: ["agent@caf-gpt.com"],
          subject: "Empty",
          body: "",
          messageId: "<invalid@forces.gc.ca>",
        })
      );

      return { aiCalls: processWithPrimeFoo.mock.calls.length, sends: resend.replies.length };
    });

    expect(result).toEqual({ aiCalls: 0, sends: 1 });
  });

  it.each([
    ["missing", undefined],
    ["malformed", "not-a-message-id"],
    ["control-character", "=?utf-8?Q?<forged@attacker.example>=00?="],
  ])("sends error replies without custom headers for %s threading values", async (label, id) => {
    const sender = `${label}-threading@forces.gc.ca`;

    const sent = await runInDurableObject(getUserAgentStub(sender), async (instance) => {
      const resend = installResendMock();
      mockPrimeFoo(vi.fn());

      await resend.deliver(
        instance,
        createInboundEmail({
          envelopeFrom: sender,
          envelopeTo: "agent@caf-gpt.com",
          from: sender,
          to: ["agent@caf-gpt.com"],
          subject: "Invalid",
          body: "",
          messageId: "<current@forces.gc.ca>",
          headers: id ? { "in-reply-to": id } : {},
        })
      );

      return resend.replies[0];
    });

    expect(sent.body.headers).toBeUndefined();
    expect(JSON.stringify(sent)).not.toContain("forged@attacker.example");
  });

  it("reuses one Idempotency-Key when the same email is processed twice", async () => {
    const sender = "repeated-invalid@forces.gc.ca";

    const result = await runInDurableObject(getUserAgentStub(sender), async (instance) => {
      const resend = installResendMock();
      const processWithPrimeFoo = vi.fn<AgentCoordinator["processWithPrimeFoo"]>();
      mockPrimeFoo(processWithPrimeFoo);

      const email = createInboundEmail({
        envelopeFrom: sender,
        envelopeTo: "agent@caf-gpt.com",
        from: sender,
        to: ["agent@caf-gpt.com"],
        subject: "Empty",
        body: "",
        messageId: "<repeated-invalid@forces.gc.ca>",
      });

      await resend.deliver(instance, email);
      await resend.deliver(instance, email);

      return {
        keys: resend.replies.map((reply) => reply.idempotencyKey),
        aiCalls: processWithPrimeFoo.mock.calls.length,
        emailId: email.task.emailId,
      };
    });

    // Resend keeps the key for 24 hours, so the second request does not send a second email.
    expect(result.aiCalls).toBe(0);
    expect(result.keys).toEqual([
      `caf-gpt-error/${result.emailId}`,
      `caf-gpt-error/${result.emailId}`,
    ]);
  });

  it("sends one sender-only error when the raw download fails", async () => {
    const sender = "parse@forces.gc.ca";

    const result = await runInDurableObject(getUserAgentStub(sender), async (instance) => {
      const resend = installResendMock();

      await resend.deliver(
        instance,
        createInboundEmail({
          envelopeFrom: sender,
          envelopeTo: "agent@caf-gpt.com",
          from: sender,
          to: ["agent@caf-gpt.com"],
          subject: "Parse",
          body: "Body",
          messageId: "<parse@forces.gc.ca>",
          rawFailureStatus: 403,
        })
      );

      return resend.replies;
    });

    expect(result).toHaveLength(1);
    expect(result[0].body.subject).toBe("Error Processing Email");
  });

  it("does not send a fallback or schedule memory after the reply request fails", async () => {
    const sender = "send-failure@forces.gc.ca";

    const result = await runInDurableObject(getUserAgentStub(sender), async (instance) => {
      const resend = installResendMock({ replyFailureStatus: 503 });
      const schedule = vi.spyOn(instance, "schedule");
      mockPrimeFoo(vi.fn(async () => ({ shouldRespond: true, content: "Response" })));

      await resend.deliver(
        instance,
        createInboundEmail({
          envelopeFrom: sender,
          envelopeTo: "agent@caf-gpt.com",
          from: sender,
          to: ["agent@caf-gpt.com"],
          subject: "Question",
          body: "Body",
          messageId: "<send-failure@forces.gc.ca>",
        })
      );

      return {
        schedules: schedule.mock.calls.length,
        replyKeys: resend.replies.map((reply) => reply.idempotencyKey.split("/")[0]),
      };
    });

    expect(result).toEqual({ schedules: 0, replyKeys: ["caf-gpt-reply"] });
  });

  it("swallows error-reply failures", async () => {
    const sender = "reply-failure@forces.gc.ca";

    await runInDurableObject(getUserAgentStub(sender), async (instance) => {
      const resend = installResendMock({ replyFailureStatus: 500 });

      mockPrimeFoo(
        vi.fn(async () => {
          throw new Error("model down");
        })
      );

      await expect(
        resend.deliver(
          instance,
          createInboundEmail({
            envelopeFrom: sender,
            envelopeTo: "agent@caf-gpt.com",
            from: sender,
            to: ["agent@caf-gpt.com"],
            subject: "Question",
            body: "Body",
            messageId: "<reply-failure@forces.gc.ca>",
          })
        )
      ).resolves.toBeUndefined();
      expect(resend.replies).toHaveLength(1);
    });
  });

  it("does not process self-loop emails", async () => {
    const aiCalls = await runInDurableObject(
      getUserAgentStub("agent@caf-gpt.com"),
      async (instance) => {
        const resend = installResendMock();
        const processWithPrimeFoo = vi.fn<AgentCoordinator["processWithPrimeFoo"]>();
        mockPrimeFoo(processWithPrimeFoo);

        await resend.deliver(
          instance,
          createInboundEmail({
            envelopeFrom: "agent@caf-gpt.com",
            envelopeTo: "agent@caf-gpt.com",
            from: "agent@caf-gpt.com",
            to: ["agent@caf-gpt.com"],
            subject: "Loop",
            body: "Loop body",
            messageId: "<loop@caf-gpt.com>",
          })
        );

        return processWithPrimeFoo.mock.calls.length + resend.replies.length;
      }
    );

    expect(aiCalls).toBe(0);
  });

  it("suppresses auto-response messages without AI work or a reply", async () => {
    const sender = "auto-response@forces.gc.ca";

    const result = await runInDurableObject(getUserAgentStub(sender), async (instance) => {
      const resend = installResendMock();
      const processWithPrimeFoo = vi.fn<AgentCoordinator["processWithPrimeFoo"]>();
      mockPrimeFoo(processWithPrimeFoo);

      await resend.deliver(
        instance,
        createInboundEmail({
          envelopeFrom: sender,
          envelopeTo: "agent@caf-gpt.com",
          from: sender,
          to: ["agent@caf-gpt.com"],
          subject: "Automatic reply",
          body: "Away",
          messageId: "<auto-response@forces.gc.ca>",
          headers: { "auto-submitted": "auto-replied" },
        })
      );

      return { aiCalls: processWithPrimeFoo.mock.calls.length, replies: resend.replies.length };
    });

    expect(result).toEqual({ aiCalls: 0, replies: 0 });
  });

  it("persists memory updates into Agent state", async () => {
    const stub = getUserAgentStub("memory@forces.gc.ca");
    vi.spyOn(MemoryFooAgent.prototype, "updateMemory").mockResolvedValue({
      updated: true,
      content: "Updated memory content",
    });

    const state = await runInDurableObject(stub, async (instance: UserAgent) => {
      instance.setState({ memory: "Old memory", versions: [] });
      await instance.runMemoryUpdate({
        emailContext: "Subject: Test\n\nUser details",
        agentReply: "Agent reply",
      });

      return instance.state;
    });

    expect(state.memory).toBe("Updated memory content");
    expect(state.versions).toEqual([expect.objectContaining({ text: "Old memory" })]);
  });

  it("does not persist oversize memory updates", async () => {
    const stub = getUserAgentStub("memory-oversize@forces.gc.ca");
    vi.spyOn(MemoryFooAgent.prototype, "updateMemory").mockResolvedValue({
      updated: true,
      content: "x".repeat(8001),
    });

    const state = await runInDurableObject(stub, async (instance: UserAgent) => {
      instance.setState({ memory: "Keep me", versions: [] });
      await instance.runMemoryUpdate({
        emailContext: "Subject: Test\n\nUser details",
        agentReply: "Agent reply",
      });

      return instance.state;
    });

    expect(state.memory).toBe("Keep me");
    expect(state.versions).toEqual([]);
  });

  it("does not snapshot empty previous memory", async () => {
    const stub = getUserAgentStub("memory-empty@forces.gc.ca");
    vi.spyOn(MemoryFooAgent.prototype, "updateMemory").mockResolvedValue({
      updated: true,
      content: "First memory",
    });

    const state = await runInDurableObject(stub, async (instance: UserAgent) => {
      await instance.runMemoryUpdate({
        emailContext: "Subject: Test\n\nUser details",
        agentReply: "Agent reply",
      });

      return instance.state;
    });

    expect(state.memory).toBe("First memory");
    expect(state.versions).toEqual([]);
  });

  it("keeps the last 10 memory snapshots", async () => {
    const stub = getUserAgentStub("memory-versions@forces.gc.ca");
    const updateMemory = vi.spyOn(MemoryFooAgent.prototype, "updateMemory");

    const state = await runInDurableObject(stub, async (instance: UserAgent) => {
      for (let i = 1; i <= 11; i++) {
        updateMemory.mockResolvedValueOnce({
          updated: true,
          content: `memory-${i}`,
        });
        await instance.runMemoryUpdate({
          emailContext: "Subject: Test\n\nUser details",
          agentReply: "Agent reply",
        });
      }

      return instance.state;
    });

    expect(state.memory).toBe("memory-11");
    expect(state.versions.map((version) => version.text)).toEqual([
      "memory-1",
      "memory-2",
      "memory-3",
      "memory-4",
      "memory-5",
      "memory-6",
      "memory-7",
      "memory-8",
      "memory-9",
      "memory-10",
    ]);
  });

  it("rethrows memory update failures so scheduled retries can run", async () => {
    const stub = getUserAgentStub("memory-failure@forces.gc.ca");
    vi.spyOn(MemoryFooAgent.prototype, "updateMemory").mockRejectedValue(
      new Error("transient model failure")
    );

    await runInDurableObject(stub, async (instance: UserAgent) => {
      await expect(
        instance.runMemoryUpdate({
          emailContext: "Subject: Test\n\nUser details",
          agentReply: "Agent reply",
        })
      ).rejects.toThrow("Scheduled memory update failed");
    });
  });
});

/** Gets a per-sender UserAgent Durable Object stub. */
function getUserAgentStub(senderEmail: string): DurableObjectStub<UserAgent> {
  return env.UserAgent.get(env.UserAgent.idFromName(getUserAgentId(senderEmail)));
}

/** Outlook's HTML quote of our 17:30Z reply as shown on a PC at the given local time. */
function buildQuotedReplyHtml(localTime: string): string {
  return (
    "<div class=WordSection1><p class=MsoNormal>Thanks</p>" +
    "<div style='border:none;border-top:solid #E1E1E1 1.0pt;padding:3.0pt 0cm 0cm 0cm'>" +
    "<p class=MsoNormal><b>From:</b> CAF-GPT &lt;agent@caf-gpt.com&gt;<br>" +
    `<b>Sent:</b> Wednesday, October 28, 2026 ${localTime}<br>` +
    "<b>To:</b> Luffy &lt;sent-offset@forces.gc.ca&gt;<br>" +
    "<b>Subject:</b> Re: Leave</p></div></div>"
  );
}

type UserAgentSchedule = Awaited<ReturnType<UserAgent["schedule"]>>;

interface PrimeCoordinatorCallOptions {
  tools?: {
    batch_research?: {
      execute: (input: { leave_queries: string[] }) => Promise<string>;
    };
  };
}

/** Replaces Prime Foo processing through the coordinator's public method contract. */
function mockPrimeFoo(implementation: AgentCoordinator["processWithPrimeFoo"]) {
  return vi
    .spyOn(AgentCoordinator.prototype, "processWithPrimeFoo")
    .mockImplementation(implementation);
}

/** Creates a faithful delayed schedule result for the Agents SDK schedule contract. */
function createMockSchedule(id: string): UserAgentSchedule {
  return {
    id,
    callback: "runMemoryUpdate",
    payload: "",
    type: "delayed",
    time: 1,
    delayInSeconds: 1,
  };
}

/** Replaces durable scheduling with a successful delayed schedule fixture. */
function mockSuccessfulSchedule(instance: UserAgent, id: string) {
  const schedule = vi.spyOn(instance, "schedule");
  // SAFETY: Vitest erases the generic schedule result to never; this fixture implements the
  // complete delayed Schedule shape returned by the Agents SDK.
  schedule.mockResolvedValue(createMockSchedule(id) as never);

  return schedule;
}
