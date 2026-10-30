/**
 * tests/workers/UserAgent.test.ts
 *
 * Workers runtime integration tests for the UserAgent Durable Object and top-level email boundary
 *
 * Top-level declarations:
 * - UserAgent routing suite: Verifies sender-keyed routing and fail-closed configuration
 * - UserAgent processing suite: Verifies SDK reply-all, sender-only errors, memory timing, reply
 *   bodies with Outlook-style quoted history (signature above the quote, chain carried forward,
 *   fail-loud on a missing Date), the Sent: offset learned from the user's own quote of our reply
 *   (default, learned, saved and reused, retention), subject/threading headers, and DO-stored
 *   thread context
 * - getUserAgentStub: Gets a per-sender UserAgent Durable Object stub
 * - getEmailBinding: Gets the UserAgent's structured Email Service binding
 * - mockPrimeFoo: Replaces Prime Foo processing through its public method contract
 * - mockSuccessfulSchedule: Replaces durable scheduling with a faithful delayed schedule
 * - createAgentEmail: Builds a mock AgentEmail with configurable RFC and envelope recipients
 * - createRoutingMessage: Builds a mock top-level Email Worker message
 * - buildRawEmail: Builds raw MIME fixtures (Date by default, optional HTML part) without
 *   propagating Bcc into parsed data
 */

/// <reference types="@cloudflare/vitest-pool-workers/types" />

import { createExecutionContext, reset, runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import type { AgentEmail } from "agents/email";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { AgentCoordinator } from "../../src/agents/AgentCoordinator";
import { MemoryFooAgent } from "../../src/agents/sub-agents";
import { getUserAgentId, type UserAgent } from "../../src/agents/UserAgent";
import { MEMORY_VERSION_RETENTION_MS } from "../../src/agents/memoryPolicy";
import worker, { createUserAgentResolver } from "../../src/index";

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

describe("UserAgent email routing", () => {
  it("routes authorized direct mail to a full-email UserAgent id", async () => {
    const resolver = createUserAgentResolver(env);

    const message = createRoutingMessage({
      from: "Test@forces.gc.ca",
      to: "agent@caf-gpt.com",
    });

    await expect(resolver(message, env)).resolves.toEqual({
      agentName: "UserAgent",
      agentId: getUserAgentId("test@forces.gc.ca"),
    });
  });

  it("ignores agent routing headers and routes by the authorized envelope sender", async () => {
    const resolver = createUserAgentResolver(env);

    const message = createRoutingMessage({
      from: "test@forces.gc.ca",
      to: "agent@caf-gpt.com",
      headers: {
        "X-Agent-Name": "other-agent",
        "X-Agent-ID": getUserAgentId("victim@forces.gc.ca"),
        "X-Agent-Sig": "forged",
        "X-Agent-Sig-Ts": "1",
      },
    });

    await expect(resolver(message, env)).resolves.toEqual({
      agentName: "UserAgent",
      agentId: getUserAgentId("test@forces.gc.ca"),
    });
  });

  it("drops unauthorized direct mail before it reaches an Agent", async () => {
    const resolver = createUserAgentResolver(env);

    const message = createRoutingMessage({
      from: "intruder@example.com",
      to: "agent@caf-gpt.com",
    });

    await expect(resolver(message, env)).resolves.toBeNull();
  });

  it("routes the exact approved external sender without authorizing its domain", async () => {
    const resolver = createUserAgentResolver(env);

    const approvedMessage = createRoutingMessage({
      from: "munshi@dhaliwal.info",
      to: "agent@caf-gpt.com",
    });

    const adjacentMessage = createRoutingMessage({
      from: "other@dhaliwal.info",
      to: "agent@caf-gpt.com",
    });

    await expect(resolver(approvedMessage, env)).resolves.toEqual({
      agentName: "UserAgent",
      agentId: getUserAgentId("munshi@dhaliwal.info"),
    });
    await expect(resolver(adjacentMessage, env)).resolves.toBeNull();
  });

  it("fails closed before routing when the email binding is missing", async () => {
    const message = createRoutingMessage({
      from: "test@forces.gc.ca",
      to: "agent@caf-gpt.com",
    });

    const boundaryEnv = { ...env };
    Reflect.deleteProperty(boundaryEnv, "EMAIL");

    await expect(
      worker.email(message, boundaryEnv, createExecutionContext())
    ).resolves.toBeUndefined();
    expect(message.setReject).toHaveBeenCalledOnce();
    expect(message.setReject).toHaveBeenCalledWith("Service temporarily unavailable");
  });

  it("rejects and returns on top-level routing failures", async () => {
    const message = createRoutingMessage({
      from: "test@forces.gc.ca",
      to: "agent@caf-gpt.com",
    });

    const brokenEnv = { ...env };
    Reflect.deleteProperty(brokenEnv, "UserAgent");

    await expect(
      worker.email(message, brokenEnv, createExecutionContext())
    ).resolves.toBeUndefined();
    expect(message.setReject).toHaveBeenCalledOnce();
    expect(message.setReject).toHaveBeenCalledWith("Service temporarily unavailable");
  });
});

describe("UserAgent email processing", () => {
  it("uses Agent.sendEmail for Outlook-style reply-all and schedules memory", async () => {
    const stub = getUserAgentStub("test@forces.gc.ca");

    const result = await runInDurableObject(stub, async (instance: UserAgent) => {
      const sentMessages: StructuredEmailMessage[] = [];
      vi.spyOn(env.AI, "run").mockRejectedValue(new Error("Unexpected classification request"));

      const processWithPrimeFoo = vi.fn<AgentCoordinator["processWithPrimeFoo"]>(
        async (_context, memory) => ({
          shouldRespond: true,
          content: "<p>AI response</p>",
          memory,
        })
      );

      const email = createAgentEmail({
        envelopeFrom: "test@forces.gc.ca",
        envelopeTo: "agent@caf-gpt.com",
        from: "Spoofed Admin <luffy@luffy.email>",
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
      const agentSendEmail = vi.spyOn(instance, "sendEmail");
      vi.spyOn(getEmailBinding(instance), "send").mockImplementation(async (message) => {
        sentMessages.push(message);

        return { messageId: "structured-reply" };
      });
      const schedule = mockSuccessfulSchedule(instance, "schedule-1");
      mockPrimeFoo(processWithPrimeFoo);

      await instance.onEmail(email);

      return {
        inboundReplyCount: getReplyCalls(email).length,
        schedules: schedule.mock.calls,
        sentMessages,
        primeFooCalls: processWithPrimeFoo.mock.calls,
        agentSendCalls: agentSendEmail.mock.calls.length,
        rawReadCalls: getRawCalls(email).length,
      };
    });

    expect(result.primeFooCalls[0][1]).toBe("remembered preference");
    expect(result.primeFooCalls[0][0]).toContain("Authenticated-Sender: test@forces.gc.ca");
    expect(result.primeFooCalls[0][0]).toContain("RFC-From: luffy@luffy.email");
    expect(result.inboundReplyCount).toBe(0);
    expect(result.agentSendCalls).toBe(1);
    expect(result.rawReadCalls).toBe(1);
    expect(result.sentMessages).toHaveLength(1);
    expect(result.sentMessages[0]).toMatchObject({
      to: ["test@forces.gc.ca", "outside@example.com"],
      cc: ["ally@forces.gc.ca", "external@example.com", "second@forces.gc.ca"],
      from: { email: "agent@caf-gpt.com", name: "CAF-GPT" },
      replyTo: "agent@caf-gpt.com",
      subject: "Re: Leave question",
      headers: {
        "In-Reply-To": "<msg-1@forces.gc.ca>",
        References: "<root@forces.gc.ca> <parent@forces.gc.ca> <msg-1@forces.gc.ca>",
      },
    });
    const sentHeaders = result.sentMessages[0].headers;
    expect(sentHeaders ?? {}).not.toHaveProperty("Message-ID");
    expect(JSON.stringify(result.sentMessages[0])).not.toContain("hidden@forces.gc.ca");
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

  it("swallows rejected memory scheduling after a successful structured send", async () => {
    const stub = getUserAgentStub("schedule-failure@forces.gc.ca");

    const result = await runInDurableObject(stub, async (instance: UserAgent) => {
      const email = createAgentEmail({
        envelopeFrom: "schedule-failure@forces.gc.ca",
        envelopeTo: "agent@caf-gpt.com",
        from: "schedule-failure@forces.gc.ca",
        to: ["agent@caf-gpt.com"],
        subject: "Question",
        body: "Body",
        messageId: "<schedule-failure@forces.gc.ca>",
      });

      const bindingSend = vi
        .spyOn(getEmailBinding(instance), "send")
        .mockResolvedValue({ messageId: "structured-reply" });

      const schedule = vi
        .spyOn(instance, "schedule")
        .mockRejectedValue(new Error("schedule unavailable"));

      mockPrimeFoo(
        vi.fn(async () => ({
          shouldRespond: true,
          content: "Response",
        }))
      );

      await expect(instance.onEmail(email)).resolves.toBeUndefined();

      return {
        sends: bindingSend.mock.calls.length,
        schedules: schedule.mock.calls.length,
        replies: getReplyCalls(email).length,
      };
    });

    expect(result).toEqual({ sends: 1, schedules: 1, replies: 0 });
  });

  it("uses the pacenote envelope recipient as sender, Reply-To, and AI context", async () => {
    const stub = getUserAgentStub("pacenote-user@forces.gc.ca");

    const result = await runInDurableObject(stub, async (instance: UserAgent) => {
      const sentMessages: StructuredEmailMessage[] = [];

      const processWithPrimeFoo = vi.fn<AgentCoordinator["processWithPrimeFoo"]>(async () => ({
        shouldRespond: true,
        content: "<p>Feedback note</p>",
      }));

      vi.spyOn(getEmailBinding(instance), "send").mockImplementation(async (message) => {
        sentMessages.push(message);

        return { messageId: "structured-reply" };
      });
      mockSuccessfulSchedule(instance, "schedule-1");
      mockPrimeFoo(processWithPrimeFoo);

      await instance.onEmail(
        createAgentEmail({
          envelopeFrom: "pacenote-user@forces.gc.ca",
          envelopeTo: "pacenote@caf-gpt.com",
          from: "pacenote-user@forces.gc.ca",
          to: ["forwarder@forces.gc.ca"],
          subject: "Feedback note",
          body: "Write a feedback note.",
          messageId: "<pacenote-1@forces.gc.ca>",
        })
      );

      return { sentMessages, primeFooCalls: processWithPrimeFoo.mock.calls };
    });

    expect(result.primeFooCalls[0][0]).toContain("Envelope-To: pacenote@caf-gpt.com");
    expect(result.primeFooCalls[0][0]).toContain("To: forwarder@forces.gc.ca");
    expect(result.sentMessages[0]).toMatchObject({
      from: { email: "pacenote@caf-gpt.com", name: "CAF-GPT" },
      replyTo: "pacenote@caf-gpt.com",
      to: ["pacenote-user@forces.gc.ca"],
      cc: ["forwarder@forces.gc.ca"],
    });
  });

  it("passes canonical threading through Agent.sendEmail without signatures", async () => {
    const stub = getUserAgentStub("threaded-output@forces.gc.ca");

    const result = await runInDurableObject(stub, async (instance: UserAgent) => {
      const agentSendEmail = vi.spyOn(instance, "sendEmail");

      const bindingSend = vi
        .spyOn(getEmailBinding(instance), "send")
        .mockResolvedValue({ messageId: "direct-binding" });

      mockSuccessfulSchedule(instance, "schedule-1");
      mockPrimeFoo(
        vi.fn(async () => ({
          shouldRespond: true,
          content: "Response",
        }))
      );

      await instance.onEmail(
        createAgentEmail({
          envelopeFrom: "threaded-output@forces.gc.ca",
          envelopeTo: "agent@caf-gpt.com",
          from: "threaded-output@forces.gc.ca",
          to: ["agent@caf-gpt.com"],
          subject: "Threaded",
          body: "Body",
          messageId: "<original@forces.gc.ca>",
          headers: { references: "<root@forces.gc.ca>" },
        })
      );

      return {
        delivered: bindingSend.mock.calls[0][0],
        agentSendCalls: agentSendEmail.mock.calls.length,
        bindingSendCalls: bindingSend.mock.calls.length,
      };
    });

    expect(result.agentSendCalls).toBe(1);
    expect(result.bindingSendCalls).toBe(1);
    expect(result.delivered.headers).toMatchObject({
      "In-Reply-To": "<original@forces.gc.ca>",
      References: "<root@forces.gc.ca> <original@forces.gc.ca>",
    });
    expect(result.delivered.headers?.["X-Agent-Sig"]).toBeUndefined();
    expect(result.delivered.headers?.["X-Agent-Sig-Ts"]).toBeUndefined();
  });

  it("adds a child Thread-Index and Thread-Topic so Exchange groups the reply", async () => {
    const stub = getUserAgentStub("outlook-thread@forces.gc.ca");

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

    const delivered = await runInDurableObject(stub, async (instance: UserAgent) => {
      const bindingSend = vi
        .spyOn(getEmailBinding(instance), "send")
        .mockResolvedValue({ messageId: "outlook-threaded" });

      mockSuccessfulSchedule(instance, "schedule-1");
      mockPrimeFoo(vi.fn(async () => ({ shouldRespond: true, content: "Response" })));

      await instance.onEmail(
        createAgentEmail({
          envelopeFrom: "outlook-thread@forces.gc.ca",
          envelopeTo: "agent@caf-gpt.com",
          from: "outlook-thread@forces.gc.ca",
          to: ["agent@caf-gpt.com"],
          subject: "feedback note please",
          body: "Body",
          messageId: "<outlook-original@forces.gc.ca>",
          headers: { "thread-index": parentIndex, "thread-topic": "feedback note please" },
        })
      );

      return bindingSend.mock.calls[0][0];
    });

    const childIndex = atob(delivered.headers?.["Thread-Index"] ?? "");
    expect(childIndex).toHaveLength(27);
    expect(childIndex.slice(0, 22)).toBe(atob(parentIndex));
    expect(delivered.headers).toMatchObject({
      "In-Reply-To": "<outlook-original@forces.gc.ca>",
      References: "<outlook-original@forces.gc.ca>",
      "Thread-Topic": "feedback note please",
    });
  });

  it.each([
    [
      "falls back to In-Reply-To when References is absent",
      "thread-fallback@forces.gc.ca",
      { "in-reply-to": "<parent@forces.gc.ca>" },
      "<fallback-current@forces.gc.ca>",
      "<parent@forces.gc.ca> <fallback-current@forces.gc.ca>",
    ],
    [
      "prefers References over In-Reply-To",
      "thread-precedence@forces.gc.ca",
      {
        references: "<root@forces.gc.ca>",
        "in-reply-to": "<ignored-parent@forces.gc.ca>",
      },
      "<precedence-current@forces.gc.ca>",
      "<root@forces.gc.ca> <precedence-current@forces.gc.ca>",
    ],
    [
      "does not duplicate the current Message-ID",
      "thread-deduplicate@forces.gc.ca",
      { references: "<root@forces.gc.ca> <deduplicate-current@forces.gc.ca>" },
      "<deduplicate-current@forces.gc.ca>",
      "<root@forces.gc.ca> <deduplicate-current@forces.gc.ca>",
    ],
    [
      "filters malformed References tokens without rejecting the email",
      "thread-filter@forces.gc.ca",
      { references: "<root@forces.gc.ca> malformed <next@forces.gc.ca>" },
      "<filter-current@forces.gc.ca>",
      "<root@forces.gc.ca> <next@forces.gc.ca> <filter-current@forces.gc.ca>",
    ],
  ])("%s", async (_label, sender, headers, messageId, expectedReferences) => {
    const stub = getUserAgentStub(sender);

    const delivered = await runInDurableObject(stub, async (instance: UserAgent) => {
      const bindingSend = vi
        .spyOn(getEmailBinding(instance), "send")
        .mockResolvedValue({ messageId: "threaded-reply" });

      mockSuccessfulSchedule(instance, "schedule-1");
      mockPrimeFoo(vi.fn(async () => ({ shouldRespond: true, content: "Response" })));

      await instance.onEmail(
        createAgentEmail({
          envelopeFrom: sender,
          envelopeTo: "agent@caf-gpt.com",
          from: sender,
          to: ["agent@caf-gpt.com"],
          subject: "Threading",
          body: "Body",
          messageId,
          headers,
        })
      );

      return bindingSend.mock.calls[0][0];
    });

    expect(delivered.headers?.References).toBe(expectedReferences);
  });

  it("quotes the inbound email below the answer and signature in Outlook's layout", async () => {
    const sender = "quote-layout@forces.gc.ca";
    const stub = getUserAgentStub(sender);

    const signature =
      '<div class="MsoNormal">\n<br><br>\nCAF-GPT<br>\nSource Code:<br>\n<pre><code>https://github.com/taoi11/caf-gpt</code></pre>\nHow to use CAF-GPT:<br>\n<pre><code>https://caf-gpt.com</code></pre>\n</div>';

    const delivered = await runInDurableObject(stub, async (instance: UserAgent) => {
      const bindingSend = vi
        .spyOn(getEmailBinding(instance), "send")
        .mockResolvedValue({ messageId: "quote-reply" });

      mockSuccessfulSchedule(instance, "schedule-1");
      mockPrimeFoo(
        vi.fn(async () => ({
          shouldRespond: true,
          content: `<p>Here is your note.</p>\n${signature}`,
        }))
      );

      await instance.onEmail(
        createAgentEmail({
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

      return bindingSend.mock.calls[0][0];
    });

    expect(delivered.subject).toBe("Re: Feedback note for Cpl Example");
    // Threading headers are unchanged by the quote.
    expect(delivered.headers).toEqual({
      "In-Reply-To": "<current@forces.gc.ca>",
      References: "<root@forces.gc.ca> <parent@forces.gc.ca> <current@forces.gc.ca>",
      "X-Agent-ID": "quote-layout%40forces.gc.ca",
      "X-Agent-Name": "user-agent",
    });
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

    const runTurn = (
      nowIso: string,
      outboundId: string,
      fields: Partial<Parameters<typeof createAgentEmail>[0]>
    ) =>
      runInDurableObject(stub, async (instance: UserAgent) => {
        vi.spyOn(Date, "now").mockReturnValue(Date.parse(nowIso));

        const send = vi
          .spyOn(getEmailBinding(instance), "send")
          .mockResolvedValue({ messageId: outboundId });

        mockSuccessfulSchedule(instance, "schedule-1");
        // SAFETY: scheduleEvery resolves a Schedule; UserAgent ignores it, and the fixture is a complete one.
        vi.spyOn(instance, "scheduleEvery").mockResolvedValue(createMockSchedule("prune") as never);
        mockPrimeFoo(vi.fn(async () => ({ shouldRespond: true, content: "<p>Ok</p>" })));
        await instance.onEmail(
          createAgentEmail({
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

        // The spy survives across runInDurableObject calls, so read this turn's (last) send.
        const message = send.mock.calls.at(-1)?.[0];

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
    const quotedHtml =
      "<div class=WordSection1><p class=MsoNormal>Thanks</p>" +
      "<div style='border:none;border-top:solid #E1E1E1 1.0pt;padding:3.0pt 0cm 0cm 0cm'>" +
      "<p class=MsoNormal><b>From:</b> CAF-GPT &lt;agent@caf-gpt.com&gt;<br>" +
      "<b>Sent:</b> Wednesday, October 28, 2026 2:30 PM<br>" +
      "<b>To:</b> Luffy &lt;sent-offset@forces.gc.ca&gt;<br>" +
      "<b>Subject:</b> Re: Leave</p></div></div>";

    const second = await runTurn("2026-10-28T17:46:00Z", "<reply2@caf-gpt.com>", {
      messageId: "<q2@forces.gc.ca>",
      date: "Wed, 28 Oct 2026 17:45:00 +0000",
      body: "Thanks",
      html: quotedHtml,
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

  it("carries a multi-level Outlook chain forward from the inbound HTML body", async () => {
    const sender = "quote-chain@forces.gc.ca";
    const stub = getUserAgentStub(sender);

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

    const delivered = await runInDurableObject(stub, async (instance: UserAgent) => {
      const bindingSend = vi
        .spyOn(getEmailBinding(instance), "send")
        .mockResolvedValue({ messageId: "chain-reply" });

      mockSuccessfulSchedule(instance, "schedule-1");
      mockPrimeFoo(vi.fn(async () => ({ shouldRespond: true, content: "<p>LEVEL-4 answer</p>" })));

      await instance.onEmail(
        createAgentEmail({
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

      return bindingSend.mock.calls[0][0];
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
    const text = delivered.text ?? "";
    expect(text.indexOf("LEVEL-4")).toBeLessThan(text.indexOf("Subject: RE: Re: chain"));
    expect(text.indexOf("LEVEL-3")).toBeLessThan(text.indexOf("LEVEL-1"));
  });

  it("fails loudly with the funny error reply instead of sending without the quote", async () => {
    const sender = "quote-fail@forces.gc.ca";
    const stub = getUserAgentStub(sender);

    const sent = await runInDurableObject(stub, async (instance: UserAgent) => {
      const bindingSend = vi
        .spyOn(getEmailBinding(instance), "send")
        .mockResolvedValue({ messageId: "error-reply" });

      mockSuccessfulSchedule(instance, "schedule-1");
      mockPrimeFoo(vi.fn(async () => ({ shouldRespond: true, content: "<p>UNQUOTED-ANSWER</p>" })));

      await instance.onEmail(
        createAgentEmail({
          envelopeFrom: sender,
          envelopeTo: "agent@caf-gpt.com",
          from: sender,
          to: ["agent@caf-gpt.com"],
          subject: "No date",
          body: "Body",
          date: null,
          messageId: "<no-date@forces.gc.ca>",
        })
      );

      return bindingSend.mock.calls.map(([message]) => message);
    });

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: sender, subject: "Error Processing Email" });
    expect(sent[0].text).toContain("I tried to write a reply and face-planted. Classic me.");
    expect(JSON.stringify(sent[0])).not.toContain("UNQUOTED-ANSWER");
  });

  it("keeps prior-turn context for Prime Foo on the user's next reply in the thread", async () => {
    const sender = "thread-memory@forces.gc.ca";
    const stub = getUserAgentStub(sender);

    const contexts = await runInDurableObject(stub, async (instance: UserAgent) => {
      vi.spyOn(getEmailBinding(instance), "send").mockResolvedValue({ messageId: "reply" });
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

      await instance.onEmail(
        createAgentEmail({
          ...base,
          subject: "Feedback note",
          body: "Pte Smith led the vehicle recovery TURN-ONE-NARRATIVE",
          messageId: "<turn1@forces.gc.ca>",
        })
      );
      // Outlook's reply to our message: References keeps turn 1, In-Reply-To is our reply's id.
      await instance.onEmail(
        createAgentEmail({
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
      await instance.onEmail(
        createAgentEmail({
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
      await instance.onEmail(
        createAgentEmail({
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

    const runTurn = (sender: string, fields: Partial<Parameters<typeof createAgentEmail>[0]>) =>
      runInDurableObject(getUserAgentStub(sender), async (instance: UserAgent) => {
        vi.spyOn(getEmailBinding(instance), "send").mockResolvedValue({
          messageId: `out-${sender}`,
        });
        mockSuccessfulSchedule(instance, "schedule-1");

        const primeFoo = vi.fn<AgentCoordinator["processWithPrimeFoo"]>(async () => ({
          shouldRespond: true,
          content: "<p>Ok</p>",
        }));

        mockPrimeFoo(primeFoo);
        await instance.onEmail(
          createAgentEmail({
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
      vi.spyOn(getEmailBinding(instance), "send").mockResolvedValue({ messageId: "out" });
      mockSuccessfulSchedule(instance, "schedule-1");
      mockPrimeFoo(
        vi.fn(async () => ({ shouldRespond: true, content: `<p>${"x".repeat(30_000)}</p>` }))
      );
      await instance.onEmail(
        createAgentEmail({
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
        vi.spyOn(getEmailBinding(instance), "send").mockResolvedValue({ messageId: "out" });
        mockSuccessfulSchedule(instance, "schedule-1");
        vi.spyOn(instance, "scheduleEvery").mockRejectedValue(new Error("schedule unavailable"));
        mockPrimeFoo(vi.fn(async () => ({ shouldRespond: true, content: "<p>Ok</p>" })));
        await instance.onEmail(
          createAgentEmail({
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
    const stub = getUserAgentStub("blank-output@forces.gc.ca");

    const result = await runInDurableObject(stub, async (instance: UserAgent) => {
      const email = createAgentEmail({
        envelopeFrom: "blank-output@forces.gc.ca",
        envelopeTo: "agent@caf-gpt.com",
        from: "blank-output@forces.gc.ca",
        to: ["agent@caf-gpt.com", "ally@forces.gc.ca"],
        cc: ["second@forces.gc.ca"],
        subject: "Question",
        body: "Sensitive inbound body",
        messageId: "<blank-output@forces.gc.ca>",
      });

      mockGenerateText.mockResolvedValueOnce({ text: "", steps: [] });
      const bindingSend = vi.spyOn(getEmailBinding(instance), "send");

      await instance.onEmail(email);

      return {
        replies: getReplyCalls(email),
        structuredSends: bindingSend.mock.calls.length,
      };
    });

    expect(result.structuredSends).toBe(0);
    expect(result.replies).toHaveLength(0);
  });

  it.each([
    "model",
    "storage",
  ])("routes real coordinator %s failures to one plain sender-only error reply", async (_label) => {
    const stub = getUserAgentStub(`${_label}@forces.gc.ca`);

    const result = await runInDurableObject(stub, async (instance: UserAgent) => {
      const email = createAgentEmail({
        envelopeFrom: `${_label}@forces.gc.ca`,
        envelopeTo: "agent@caf-gpt.com",
        from: `${_label}@forces.gc.ca`,
        to: ["agent@caf-gpt.com", "ally@forces.gc.ca"],
        cc: ["second@forces.gc.ca"],
        subject: "Question",
        body: "Sensitive inbound body",
        messageId: `<${_label}@forces.gc.ca>`,
      });

      if (_label === "model") {
        mockGenerateText.mockRejectedValueOnce(new Error("model down with sensitive content"));
      } else {
        mockGenerateText.mockImplementationOnce(async (options: PrimeCoordinatorCallOptions) => {
          await options.tools?.batch_research?.execute({
            leave_queries: ["Read unavailable policy storage"],
          });

          return { text: "must not be returned", steps: [] };
        });
      }

      const bindingSend = vi.spyOn(getEmailBinding(instance), "send");

      await instance.onEmail(email);

      return { replies: getReplyCalls(email), structuredSends: bindingSend.mock.calls };
    });

    expect(result.structuredSends).toHaveLength(1);
    expect(result.replies).toHaveLength(0);
    const sent = result.structuredSends[0][0];
    expect(sent).toMatchObject({
      from: { email: "agent@caf-gpt.com", name: "CAF-GPT" },
      to: `${_label}@forces.gc.ca`,
      subject: "Error Processing Email",
      headers: {
        "In-Reply-To": `<${_label}@forces.gc.ca>`,
        References: `<${_label}@forces.gc.ca>`,
      },
    });
    expect(sent.text).toBeTypeOf("string");
    expect(sent.html).toBeUndefined();
    expect(sent.headers).not.toHaveProperty("Message-ID");
    expect(JSON.stringify(sent)).not.toContain("Sensitive inbound body");
    expect(JSON.stringify(sent)).not.toContain("ally@forces.gc.ca");
  });

  it("resolves validation failures without AI work", async () => {
    const stub = getUserAgentStub("invalid@forces.gc.ca");

    const result = await runInDurableObject(stub, async (instance: UserAgent) => {
      const processWithPrimeFoo = vi.fn<AgentCoordinator["processWithPrimeFoo"]>();

      const email = createAgentEmail({
        envelopeFrom: "invalid@forces.gc.ca",
        envelopeTo: "agent@caf-gpt.com",
        from: "invalid@forces.gc.ca",
        to: ["agent@caf-gpt.com"],
        subject: "Empty",
        body: "",
        messageId: "<invalid@forces.gc.ca>",
      });

      const bindingSend = vi.spyOn(getEmailBinding(instance), "send");
      mockPrimeFoo(processWithPrimeFoo);

      await instance.onEmail(email);

      return {
        aiCalls: processWithPrimeFoo.mock.calls.length,
        replies: getReplyCalls(email).length,
        sends: bindingSend.mock.calls.length,
      };
    });

    expect(result).toEqual({ aiCalls: 0, replies: 0, sends: 1 });
  });

  it.each([
    ["missing", undefined],
    ["malformed", "not-a-message-id"],
  ])("omits %s threading values from structured error replies", async (label, messageId) => {
    const sender = `${label}@forces.gc.ca`;
    const stub = getUserAgentStub(sender);

    const sent = await runInDurableObject(stub, async (instance: UserAgent) => {
      const bindingSend = vi.spyOn(getEmailBinding(instance), "send");

      const email = createAgentEmail({
        envelopeFrom: sender,
        envelopeTo: "agent@caf-gpt.com",
        from: sender,
        to: ["agent@caf-gpt.com"],
        subject: "Invalid",
        body: "",
        messageId,
      });

      mockPrimeFoo(vi.fn());

      await instance.onEmail(email);

      return bindingSend.mock.calls[0][0];
    });

    expect(sent.to).toBe(sender);
    expect(sent.headers ?? {}).not.toHaveProperty("Message-ID");
    expect(sent.headers ?? {}).not.toHaveProperty("In-Reply-To");
    expect(sent.headers ?? {}).not.toHaveProperty("References");
  });

  it("excludes an encoded control-character In-Reply-To from the structured error reply", async () => {
    const sender = "invalid-in-reply-to@forces.gc.ca";
    const currentMessageId = "<safe-current@forces.gc.ca>";
    const invalidInReplyTo = "=?utf-8?Q?<forged@attacker.example>=00?=";
    const stub = getUserAgentStub(sender);

    const sent = await runInDurableObject(stub, async (instance: UserAgent) => {
      const bindingSend = vi.spyOn(getEmailBinding(instance), "send");

      const email = createAgentEmail({
        envelopeFrom: sender,
        envelopeTo: "agent@caf-gpt.com",
        from: sender,
        to: ["agent@caf-gpt.com"],
        subject: "Invalid threading",
        body: "Body",
        messageId: currentMessageId,
        headers: { "in-reply-to": invalidInReplyTo },
      });

      mockPrimeFoo(vi.fn());

      await instance.onEmail(email);

      return bindingSend.mock.calls[0][0];
    });

    expect(sent.headers).toMatchObject({
      "In-Reply-To": currentMessageId,
      References: currentMessageId,
    });
    expect(JSON.stringify(sent)).not.toContain("forged@attacker.example");
    expect(JSON.stringify(sent)).not.toContain(invalidInReplyTo);
  });

  it("handles each repeated invalid delivery independently", async () => {
    const stub = getUserAgentStub("repeated-invalid@forces.gc.ca");

    const result = await runInDurableObject(stub, async (instance: UserAgent) => {
      const email = createAgentEmail({
        envelopeFrom: "repeated-invalid@forces.gc.ca",
        envelopeTo: "agent@caf-gpt.com",
        from: "repeated-invalid@forces.gc.ca",
        to: ["agent@caf-gpt.com"],
        subject: "Empty",
        body: "",
        messageId: "<repeated-invalid@forces.gc.ca>",
      });

      const bindingSend = vi.spyOn(getEmailBinding(instance), "send");
      const processWithPrimeFoo = vi.fn<AgentCoordinator["processWithPrimeFoo"]>();
      mockPrimeFoo(processWithPrimeFoo);

      await instance.onEmail(email);
      await instance.onEmail(email);

      return {
        structuredSends: bindingSend.mock.calls.length,
        messageIds: bindingSend.mock.calls.map(([message]) => message.headers?.["Message-ID"]),
        aiCalls: processWithPrimeFoo.mock.calls.length,
        replies: getReplyCalls(email).length,
        rawReads: getRawCalls(email).length,
      };
    });

    expect(result).toMatchObject({ structuredSends: 2, aiCalls: 0, replies: 0, rawReads: 2 });
    expect(result.messageIds).toEqual([undefined, undefined]);
  });

  it("processes repeated deliveries twice without a deduplication ledger", async () => {
    const stub = getUserAgentStub("duplicate@forces.gc.ca");

    const result = await runInDurableObject(stub, async (instance: UserAgent) => {
      const email = createAgentEmail({
        envelopeFrom: "duplicate@forces.gc.ca",
        envelopeTo: "agent@caf-gpt.com",
        from: "duplicate@forces.gc.ca",
        to: ["agent@caf-gpt.com"],
        subject: "Duplicate",
        body: "Same delivery",
        messageId: "<duplicate@forces.gc.ca>",
      });

      const processWithPrimeFoo = vi.fn(async () => ({
        shouldRespond: true,
        content: "One response",
      }));

      const bindingSend = vi
        .spyOn(getEmailBinding(instance), "send")
        .mockResolvedValue({ messageId: "reply" });

      const schedule = mockSuccessfulSchedule(instance, "memory");
      mockPrimeFoo(processWithPrimeFoo);

      await instance.onEmail(email);
      await instance.onEmail(email);

      return {
        aiCalls: processWithPrimeFoo.mock.calls.length,
        sends: bindingSend.mock.calls.length,
        schedules: schedule.mock.calls,
      };
    });

    expect(result.aiCalls).toBe(2);
    expect(result.sends).toBe(2);
    expect(result.schedules).toHaveLength(2);
    expect(result.schedules[0]).toEqual([
      1,
      "runMemoryUpdate",
      {
        emailContext: expect.any(String),
        agentReply: "One response",
      },
      { retry: { maxAttempts: 3 }, idempotent: true },
    ]);
  });

  it("sends one structured error for each repeated raw-read failure", async () => {
    const stub = getUserAgentStub("parse@forces.gc.ca");

    const result = await runInDurableObject(stub, async (instance: UserAgent) => {
      const email = createAgentEmail({
        envelopeFrom: "parse@forces.gc.ca",
        envelopeTo: "agent@caf-gpt.com",
        from: "parse@forces.gc.ca",
        to: ["agent@caf-gpt.com"],
        subject: "Parse",
        body: "Body",
        messageId: "<parse@forces.gc.ca>",
        rawFailure: new Error("raw read failed"),
      });

      const bindingSend = vi.spyOn(getEmailBinding(instance), "send");

      await instance.onEmail(email);
      await instance.onEmail(email);

      return { sends: bindingSend.mock.calls, rawReads: getRawCalls(email).length };
    });

    expect(result.sends).toHaveLength(2);
    expect(result.sends[0][0].to).toBe("parse@forces.gc.ca");
    expect(result.rawReads).toBe(2);
  });

  it("does not send a fallback or schedule memory after sendEmail fails", async () => {
    const stub = getUserAgentStub("send-failure@forces.gc.ca");

    const result = await runInDurableObject(stub, async (instance: UserAgent) => {
      const email = createAgentEmail({
        envelopeFrom: "send-failure@forces.gc.ca",
        envelopeTo: "agent@caf-gpt.com",
        from: "send-failure@forces.gc.ca",
        to: ["agent@caf-gpt.com"],
        subject: "Question",
        body: "Body",
        messageId: "<send-failure@forces.gc.ca>",
      });

      const schedule = vi.spyOn(instance, "schedule");
      vi.spyOn(getEmailBinding(instance), "send").mockRejectedValue(
        new Error("email service unavailable")
      );
      mockPrimeFoo(vi.fn(async () => ({ shouldRespond: true, content: "Response" })));

      await instance.onEmail(email);

      return {
        schedules: schedule.mock.calls.length,
        replies: getReplyCalls(email).length,
      };
    });

    expect(result).toEqual({ schedules: 0, replies: 0 });
  });

  it("swallows error-reply failures", async () => {
    const stub = getUserAgentStub("reply-failure@forces.gc.ca");

    await runInDurableObject(stub, async (instance: UserAgent) => {
      const email = createAgentEmail({
        envelopeFrom: "reply-failure@forces.gc.ca",
        envelopeTo: "agent@caf-gpt.com",
        from: "reply-failure@forces.gc.ca",
        to: ["agent@caf-gpt.com"],
        subject: "Question",
        body: "Body",
        messageId: "<reply-failure@forces.gc.ca>",
      });

      const bindingSend = vi
        .spyOn(getEmailBinding(instance), "send")
        .mockRejectedValue(new Error("reply rejected"));

      mockPrimeFoo(
        vi.fn(async () => {
          throw new Error("model down");
        })
      );

      await expect(instance.onEmail(email)).resolves.toBeUndefined();
      expect(bindingSend).toHaveBeenCalledOnce();
      expect(getReplyCalls(email)).toHaveLength(0);
    });
  });

  it("does not process self-loop emails", async () => {
    const stub = getUserAgentStub("agent@caf-gpt.com");

    const aiCalls = await runInDurableObject(stub, async (instance: UserAgent) => {
      const processWithPrimeFoo = vi.fn<AgentCoordinator["processWithPrimeFoo"]>();
      mockPrimeFoo(processWithPrimeFoo);

      await instance.onEmail(
        createAgentEmail({
          envelopeFrom: "agent@caf-gpt.com",
          envelopeTo: "agent@caf-gpt.com",
          from: "agent@caf-gpt.com",
          to: ["agent@caf-gpt.com"],
          subject: "Loop",
          body: "Loop body",
          messageId: "<loop@caf-gpt.com>",
        })
      );

      return processWithPrimeFoo.mock.calls.length;
    });

    expect(aiCalls).toBe(0);
  });

  it("suppresses auto-response messages without AI work or a reply", async () => {
    const stub = getUserAgentStub("auto-response@forces.gc.ca");

    const result = await runInDurableObject(stub, async (instance: UserAgent) => {
      const processWithPrimeFoo = vi.fn<AgentCoordinator["processWithPrimeFoo"]>();

      const email = createAgentEmail({
        envelopeFrom: "auto-response@forces.gc.ca",
        envelopeTo: "agent@caf-gpt.com",
        from: "auto-response@forces.gc.ca",
        to: ["agent@caf-gpt.com"],
        subject: "Automatic reply",
        body: "Away",
        messageId: "<auto-response@forces.gc.ca>",
        headers: { "auto-submitted": "auto-replied" },
      });

      mockPrimeFoo(processWithPrimeFoo);

      await instance.onEmail(email);

      return {
        aiCalls: processWithPrimeFoo.mock.calls.length,
        replies: getReplyCalls(email).length,
      };
    });

    expect(result).toEqual({ aiCalls: 0, replies: 0 });
  });

  it.each([
    "update_memory",
    "leave_memory_unchanged",
  ] as const)("persists the scheduled LLM's %s decision and prunes expired versions", async (toolName) => {
    const stub = getUserAgentStub("memory@forces.gc.ca");

    const result = await runInDurableObject(stub, async (instance: UserAgent) => {
      vi.spyOn(env.AI, "run").mockRejectedValue(new Error("Unexpected classification request"));
      const gateway = env.AI.gateway("caf-gpt");

      const run = vi.spyOn(gateway, "run").mockResolvedValue(
        Response.json({
          id: "memory-response",
          created_at: 1_750_000_000,
          model: "gpt-5.6-luna",
          output: [
            {
              type: "function_call",
              id: "memory-tool-item",
              call_id: "memory-decision",
              name: toolName,
              arguments: JSON.stringify(
                toolName === "update_memory" ? { content: "Updated memory content" } : {}
              ),
            },
          ],
        })
      );

      vi.spyOn(env.AI, "gateway").mockReturnValue(gateway);
      const now = Date.now();
      const expired = now - MEMORY_VERSION_RETENTION_MS;
      const archived = { ts: expired - 1000, text: "Newest expired memory" };
      instance.setState({
        memory: "Old memory",
        versions: [{ ts: expired - 2000, text: "Older expired memory" }, archived],
      });

      const task = {
        emailContext: "Subject: Preference\n\nI prefer short answers.",
        agentReply: "Understood.",
      };

      await instance.runMemoryUpdate(task);

      return { state: instance.state, requests: run.mock.calls, archived, task };
    });

    expect(result.requests).toHaveLength(1);
    expect(result.requests[0][0]).toEqual([
      expect.objectContaining({
        provider: "openai",
        endpoint: "v1/responses",
        query: expect.objectContaining({
          model: "gpt-5.6-luna",
          tool_choice: "required",
        }),
      }),
    ]);
    const request = JSON.stringify(result.requests[0][0]);
    expect(request).toContain("Old memory");
    expect(request).toContain("Memory Update Agent");
    expect(request).toContain("I prefer short answers.");
    expect(request).toContain(result.task.agentReply);
    expect(result.state.memory).toBe(
      toolName === "update_memory" ? "Updated memory content" : "Old memory"
    );
    expect(result.state.versions).toEqual(
      toolName === "update_memory"
        ? [result.archived, expect.objectContaining({ text: "Old memory" })]
        : [result.archived]
    );
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

/** Gets the structured Email Service binding held by a UserAgent instance. */
function getEmailBinding(instance: UserAgent): Env["EMAIL"] {
  // SAFETY: The Agents SDK initializes every UserAgent with its configured Env binding object.
  const runtimeAccess = instance as UserAgent & { env: Env };

  return runtimeAccess.env.EMAIL;
}

type StructuredEmailMessage = Parameters<Env["EMAIL"]["send"]>[0];

type UserAgentSchedule = Awaited<ReturnType<UserAgent["schedule"]>>;

type MockAgentEmail = Omit<AgentEmail, "getRaw" | "setReject" | "forward" | "reply"> & {
  getRaw: Mock<AgentEmail["getRaw"]>;
  setReject: Mock<AgentEmail["setReject"]>;
  forward: Mock<AgentEmail["forward"]>;
  reply: Mock<AgentEmail["reply"]>;
};

interface AgentEmailOptions {
  envelopeFrom: string;
  envelopeTo: string;
  from: string;
  replyTo?: string[];
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  /** Date header; defaults to a fixed date, null omits it. */
  date?: string | null;
  html?: string;
  messageId?: string;
  headers?: Record<string, string>;
  rawOverride?: string;
  rawFailure?: Error;
  replyFailure?: Error;
}

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

/** Builds a mock AgentEmail with configurable RFC and envelope recipients. */
function createAgentEmail(options: AgentEmailOptions): MockAgentEmail {
  const raw = options.rawOverride ?? buildRawEmail(options);

  const headers = new Headers({
    from: options.from,
    to: options.to.join(", "),
    subject: options.subject,
  });

  if (options.replyTo?.length) headers.set("reply-to", options.replyTo.join(", "));

  if (options.cc?.length) headers.set("cc", options.cc.join(", "));

  if (options.bcc?.length) headers.set("bcc", options.bcc.join(", "));

  if (options.messageId) headers.set("message-id", options.messageId);

  for (const [name, value] of Object.entries(options.headers ?? {})) headers.set(name, value);

  const getRaw = options.rawFailure
    ? vi.fn<AgentEmail["getRaw"]>(async () => {
        throw options.rawFailure;
      })
    : vi.fn<AgentEmail["getRaw"]>(async () => new TextEncoder().encode(raw));

  const reply = options.replyFailure
    ? vi.fn<AgentEmail["reply"]>(async () => {
        throw options.replyFailure;
      })
    : vi.fn<AgentEmail["reply"]>(async () => ({ messageId: "mock-reply" }));

  return {
    from: options.envelopeFrom,
    to: options.envelopeTo,
    headers,
    rawSize: raw.length,
    getRaw,
    setReject: vi.fn<AgentEmail["setReject"]>(),
    forward: vi.fn<AgentEmail["forward"]>(),
    reply,
  };
}

/** Returns the typed inbound reply calls for a mock AgentEmail. */
function getReplyCalls(email: MockAgentEmail): Array<[Parameters<AgentEmail["reply"]>[0]]> {
  return email.reply.mock.calls;
}

/** Returns the recorded raw-read calls for a mock AgentEmail. */
function getRawCalls(email: MockAgentEmail): Array<Parameters<AgentEmail["getRaw"]>> {
  return email.getRaw.mock.calls;
}

/** Builds a mock top-level Email Worker message. */
function createRoutingMessage(options: {
  from: string;
  to: string;
  headers?: Record<string, string>;
}) {
  return {
    from: options.from,
    to: options.to,
    headers: new Headers(options.headers),
    raw: new ReadableStream<Uint8Array>(),
    rawSize: 0,
    setReject: vi.fn<ForwardableEmailMessage["setReject"]>(),
    forward: vi.fn<ForwardableEmailMessage["forward"]>(),
    reply: vi.fn<ForwardableEmailMessage["reply"]>(),
  } satisfies ForwardableEmailMessage;
}

/** Builds raw MIME fixtures; Bcc is present only to prove it is never propagated. */
function buildRawEmail(options: AgentEmailOptions): string {
  const headers = [
    `From: ${options.from}`,
    ...(options.replyTo?.length ? [`Reply-To: ${options.replyTo.join(", ")}`] : []),
    `To: ${options.to.join(", ")}`,
    ...(options.cc?.length ? [`Cc: ${options.cc.join(", ")}`] : []),
    ...(options.bcc?.length ? [`Bcc: ${options.bcc.join(", ")}`] : []),
    `Subject: ${options.subject}`,
    ...(options.messageId ? [`Message-ID: ${options.messageId}`] : []),
    ...(options.date === null
      ? []
      : [`Date: ${options.date ?? "Wed, 28 Oct 2026 17:29:00 +0000"}`]),
    ...Object.entries(options.headers ?? {}).map(([name, value]) => `${name}: ${value}`),
  ];

  if (options.html) {
    return [
      ...headers,
      'Content-Type: multipart/alternative; boundary="caf-gpt-test"',
      "",
      "--caf-gpt-test",
      "Content-Type: text/plain; charset=utf-8",
      "",
      options.body,
      "--caf-gpt-test",
      "Content-Type: text/html; charset=utf-8",
      "",
      options.html,
      "--caf-gpt-test--",
    ].join("\r\n");
  }

  return `${[...headers, "Content-Type: text/plain; charset=utf-8"].join("\r\n")}\r\n\r\n${options.body}`;
}
