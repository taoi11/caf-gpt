/**
 * tests/workers/UserAgent.test.ts
 *
 * Workers runtime integration tests for the UserAgent Durable Object and top-level email boundary
 *
 * Top-level declarations:
 * - UserAgent routing suite: Verifies sender-keyed routing and fail-closed configuration
 * - UserAgent processing suite: Verifies SDK reply-all, sender-only errors, and memory timing
 * - getUserAgentStub: Gets a per-sender UserAgent Durable Object stub
 * - getEmailBinding: Gets the UserAgent's structured Email Service binding
 * - createAgentEmail: Builds a mock AgentEmail with configurable RFC and envelope recipients
 * - createRoutingMessage: Builds a mock top-level Email Worker message
 * - buildRawEmail: Builds raw MIME fixtures without propagating Bcc into parsed data
 */

/// <reference types="@cloudflare/vitest-pool-workers/types" />

import { reset, runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import type { AgentEmail } from "agents/email";
import { afterEach, describe, expect, it, vi } from "vitest";

const { mockGenerateText } = vi.hoisted(() => ({
  mockGenerateText: vi.fn(),
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return { ...actual, generateText: mockGenerateText };
});

import { MemoryFooAgent } from "../../src/agents/sub-agents";
import { getUserAgentId, type UserAgent } from "../../src/agents/UserAgent";
import worker, { createUserAgentResolver } from "../../src/index";

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
    const boundaryEnv = { ...env, EMAIL: undefined } as unknown as Env;

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
    const brokenEnv = { ...env, UserAgent: undefined } as unknown as Env;

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
      const schedules: unknown[][] = [];
      const sentMessages: unknown[] = [];
      const processWithPrimeFoo = vi.fn(async (_context: string, memory?: string) => ({
        shouldRespond: true,
        content: "<p>AI response</p>",
        memory,
      }));
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

      instance.setState({ memory: "remembered preference" });
      const agentSendEmail = vi.spyOn(instance, "sendEmail");
      vi.spyOn(getEmailBinding(instance), "send").mockImplementation(async (message) => {
        sentMessages.push(message);
        return { messageId: "structured-reply" };
      });
      vi.spyOn(instance, "schedule").mockImplementation(async (...args) => {
        schedules.push(args);
        return { id: "schedule-1" } as never;
      });
      (instance as unknown as { agentCoordinator: unknown }).agentCoordinator = {
        processWithPrimeFoo,
      };

      await instance.onEmail(email);

      return {
        inboundReplyCount: getReplyCalls(email).length,
        schedules,
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
    const sentHeaders = (result.sentMessages[0] as { headers?: Record<string, string> }).headers;
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
      (instance as unknown as { agentCoordinator: unknown }).agentCoordinator = {
        processWithPrimeFoo: vi.fn(async () => ({
          shouldRespond: true,
          content: "Response",
        })),
      };

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
      const sentMessages: unknown[] = [];
      const processWithPrimeFoo = vi.fn(async (_context: string) => ({
        shouldRespond: true,
        content: "<p>Feedback note</p>",
      }));
      vi.spyOn(getEmailBinding(instance), "send").mockImplementation(async (message) => {
        sentMessages.push(message);
        return { messageId: "structured-reply" };
      });
      vi.spyOn(instance, "schedule").mockResolvedValue({ id: "schedule-1" } as never);
      (instance as unknown as { agentCoordinator: unknown }).agentCoordinator = {
        processWithPrimeFoo,
      };

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
      let message: unknown;
      const agentSendEmail = vi.spyOn(instance, "sendEmail");
      const bindingSend = vi
        .spyOn(getEmailBinding(instance), "send")
        .mockImplementation(async (value: unknown) => {
          message = value;
          return { messageId: "direct-binding" };
        });
      vi.spyOn(instance, "schedule").mockResolvedValue({ id: "schedule-1" } as never);
      (instance as unknown as { agentCoordinator: unknown }).agentCoordinator = {
        processWithPrimeFoo: vi.fn(async () => ({
          shouldRespond: true,
          content: "Response",
        })),
      };

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
        delivered: message as { headers: Record<string, string> },
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
    expect(result.delivered.headers["X-Agent-Sig"]).toBeUndefined();
    expect(result.delivered.headers["X-Agent-Sig-Ts"]).toBeUndefined();
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
      let message: unknown;
      vi.spyOn(getEmailBinding(instance), "send").mockImplementation(async (value: unknown) => {
        message = value;
        return { messageId: "threaded-reply" };
      });
      vi.spyOn(instance, "schedule").mockResolvedValue({ id: "schedule-1" } as never);
      (instance as unknown as { agentCoordinator: unknown }).agentCoordinator = {
        processWithPrimeFoo: vi.fn(async () => ({ shouldRespond: true, content: "Response" })),
      };

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

      return message as { headers: Record<string, string> };
    });

    expect(delivered.headers.References).toBe(expectedReferences);
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
      const processWithPrimeFoo = vi.fn();
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
      (instance as unknown as { agentCoordinator: unknown }).agentCoordinator = {
        processWithPrimeFoo,
      };

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
      (instance as unknown as { agentCoordinator: unknown }).agentCoordinator = {
        processWithPrimeFoo: vi.fn(),
      };

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
      (instance as unknown as { agentCoordinator: unknown }).agentCoordinator = {
        processWithPrimeFoo: vi.fn(),
      };

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
      const processWithPrimeFoo = vi.fn();
      (instance as unknown as { agentCoordinator: unknown }).agentCoordinator = {
        processWithPrimeFoo,
      };

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
      const schedule = vi.spyOn(instance, "schedule").mockResolvedValue({ id: "memory" } as never);
      (instance as unknown as { agentCoordinator: unknown }).agentCoordinator = {
        processWithPrimeFoo,
      };

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
      (instance as unknown as { agentCoordinator: unknown }).agentCoordinator = {
        processWithPrimeFoo: vi.fn(async () => ({ shouldRespond: true, content: "Response" })),
      };

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
      (instance as unknown as { agentCoordinator: unknown }).agentCoordinator = {
        processWithPrimeFoo: vi.fn(async () => {
          throw new Error("model down");
        }),
      };

      await expect(instance.onEmail(email)).resolves.toBeUndefined();
      expect(bindingSend).toHaveBeenCalledOnce();
      expect(getReplyCalls(email)).toHaveLength(0);
    });
  });

  it("does not process self-loop emails", async () => {
    const stub = getUserAgentStub("agent@caf-gpt.com");

    const aiCalls = await runInDurableObject(stub, async (instance: UserAgent) => {
      const processWithPrimeFoo = vi.fn();
      (instance as unknown as { agentCoordinator: unknown }).agentCoordinator = {
        processWithPrimeFoo,
      };

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
      const processWithPrimeFoo = vi.fn();
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
      (instance as unknown as { agentCoordinator: unknown }).agentCoordinator = {
        processWithPrimeFoo,
      };

      await instance.onEmail(email);
      return {
        aiCalls: processWithPrimeFoo.mock.calls.length,
        replies: getReplyCalls(email).length,
      };
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
      instance.setState({ memory: "Old memory" });
      await instance.runMemoryUpdate({
        emailContext: "Subject: Test\n\nUser details",
        agentReply: "Agent reply",
      });
      return instance.state;
    });

    expect(state.memory).toBe("Updated memory content");
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
  return (instance as unknown as { env: Env }).env.EMAIL;
}

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
  messageId?: string;
  headers?: Record<string, string>;
  rawOverride?: string;
  rawFailure?: Error;
  replyFailure?: Error;
}

interface PrimeCoordinatorCallOptions {
  tools?: {
    batch_research?: {
      execute: (input: { leave_queries: string[] }) => Promise<unknown>;
    };
  };
}

/** Builds a mock AgentEmail with configurable RFC and envelope recipients. */
function createAgentEmail(options: AgentEmailOptions): AgentEmail {
  const raw = options.rawOverride ?? buildRawEmail(options);
  const headers = new Headers({
    from: options.from,
    to: options.to.join(", "),
    ...(options.replyTo?.length ? { "reply-to": options.replyTo.join(", ") } : {}),
    ...(options.cc?.length ? { cc: options.cc.join(", ") } : {}),
    ...(options.bcc?.length ? { bcc: options.bcc.join(", ") } : {}),
    subject: options.subject,
    ...(options.messageId ? { "message-id": options.messageId } : {}),
    ...options.headers,
  });

  return {
    from: options.envelopeFrom,
    to: options.envelopeTo,
    headers,
    rawSize: raw.length,
    getRaw: options.rawFailure
      ? vi.fn(async () => {
          throw options.rawFailure;
        })
      : vi.fn(async () => new TextEncoder().encode(raw)),
    setReject: vi.fn(),
    forward: vi.fn(),
    reply: options.replyFailure
      ? vi.fn(async () => {
          throw options.replyFailure;
        })
      : vi.fn(async () => ({ messageId: "mock-reply" })),
  };
}

/** Returns the typed inbound reply calls for a mock AgentEmail. */
function getReplyCalls(email: AgentEmail): Array<[Parameters<AgentEmail["reply"]>[0]]> {
  return (
    email.reply as unknown as {
      mock: { calls: Array<[Parameters<AgentEmail["reply"]>[0]]> };
    }
  ).mock.calls;
}

/** Returns the recorded raw-read calls for a mock AgentEmail. */
function getRawCalls(email: AgentEmail): unknown[][] {
  return (email.getRaw as unknown as { mock: { calls: unknown[][] } }).mock.calls;
}

/** Builds a mock top-level Email Worker message. */
function createRoutingMessage(options: {
  from: string;
  to: string;
  headers?: Record<string, string>;
}): ForwardableEmailMessage {
  return {
    from: options.from,
    to: options.to,
    headers: new Headers(options.headers),
    raw: new ReadableStream(),
    rawSize: 0,
    setReject: vi.fn(),
    forward: vi.fn(),
    reply: vi.fn(),
  } as unknown as ForwardableEmailMessage;
}

/** Builds a minimal ExecutionContext for direct top-level handler tests. */
function createExecutionContext(): ExecutionContext {
  return {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
    props: {},
  } as unknown as ExecutionContext;
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
    ...Object.entries(options.headers ?? {}).map(([name, value]) => `${name}: ${value}`),
    "Content-Type: text/plain; charset=utf-8",
  ];

  return `${headers.join("\r\n")}\r\n\r\n${options.body}`;
}
