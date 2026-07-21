/**
 * tests/workers/UserAgent.test.ts
 *
 * Workers runtime integration tests for the UserAgent Durable Object and top-level email boundary
 *
 * Top-level declarations:
 * - UserAgent routing suite: Verifies direct and signed routing plus fail-closed configuration
 * - UserAgent processing suite: Verifies structured success, sender-only errors, and memory timing
 * - getUserAgentStub: Gets a per-sender UserAgent Durable Object stub
 * - getEmailBinding: Gets the UserAgent's structured Email Service binding
 * - createAgentEmail: Builds a mock AgentEmail with configurable RFC and envelope recipients
 * - createRoutingMessage: Builds a mock top-level Email Worker message
 * - buildRawEmail: Builds raw MIME fixtures without propagating Bcc into parsed data
 */

/// <reference types="@cloudflare/vitest-pool-workers/types" />

import { reset, runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { type AgentEmail, signAgentHeaders } from "agents/email";
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

  it("routes a signed reply only to the envelope sender's canonical UserAgent id", async () => {
    const resolver = createUserAgentResolver(env);
    const signedHeaders = await signAgentHeaders(
      env.EMAIL_SECRET,
      "user-agent",
      getUserAgentId("test@forces.gc.ca")
    );
    const message = createRoutingMessage({
      from: "test@forces.gc.ca",
      to: "agent@caf-gpt.com",
      headers: signedHeaders,
    });

    await expect(resolver(message, env)).resolves.toEqual({
      agentName: "user-agent",
      agentId: getUserAgentId("test@forces.gc.ca"),
      _secureRouted: true,
    });
  });

  it("rejects replay of another authorized sender's valid signed route", async () => {
    const resolver = createUserAgentResolver(env);
    const signedHeaders = await signAgentHeaders(
      env.EMAIL_SECRET,
      "user-agent",
      getUserAgentId("victim@forces.gc.ca")
    );

    await expect(
      resolver(
        createRoutingMessage({
          from: "test@forces.gc.ca",
          to: "agent@caf-gpt.com",
          headers: signedHeaders,
        }),
        env
      )
    ).resolves.toBeNull();
  });

  it("rejects partial signed routing headers without direct fallback", async () => {
    const resolver = createUserAgentResolver(env);
    const message = createRoutingMessage({
      from: "test@forces.gc.ca",
      to: "agent@caf-gpt.com",
      headers: { "X-Agent-Name": "user-agent" },
    });

    await expect(resolver(message, env)).resolves.toBeNull();
  });

  it("rejects a valid signature for a noncanonical agent name", async () => {
    const resolver = createUserAgentResolver(env);
    const headers = await signAgentHeaders(
      env.EMAIL_SECRET,
      "UserAgent",
      getUserAgentId("test@forces.gc.ca")
    );

    await expect(
      resolver(
        createRoutingMessage({
          from: "test@forces.gc.ca",
          to: "agent@caf-gpt.com",
          headers,
        }),
        env
      )
    ).resolves.toBeNull();
  });

  it("drops unauthorized direct mail before it reaches an Agent", async () => {
    const resolver = createUserAgentResolver(env);
    const message = createRoutingMessage({
      from: "intruder@example.com",
      to: "agent@caf-gpt.com",
    });

    await expect(resolver(message, env)).resolves.toBeNull();
  });

  it.each([
    ["missing secret", { EMAIL_SECRET: undefined }],
    ["empty secret", { EMAIL_SECRET: "" }],
    ["missing binding", { EMAIL: undefined }],
  ])("fails closed before routing for %s", async (_label, overrides) => {
    const message = createRoutingMessage({
      from: "test@forces.gc.ca",
      to: "agent@caf-gpt.com",
    });
    const boundaryEnv = { ...env, ...overrides } as unknown as Env;

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
  it("sends structured signed reply-all directly through the binding and never inbound reply", async () => {
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
        from: "Test Member <test@forces.gc.ca>",
        replyTo: ["TEST@forces.gc.ca"],
        to: ["agent@caf-gpt.com", "test@forces.gc.ca", "ally@forces.gc.ca"],
        cc: ["outsider@example.com", "not-an-address", "ALLY@forces.gc.ca", "second@forces.gc.ca"],
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
    expect(result.inboundReplyCount).toBe(0);
    expect(result.agentSendCalls).toBe(0);
    expect(result.rawReadCalls).toBe(1);
    expect(result.sentMessages).toHaveLength(1);
    expect(result.sentMessages[0]).toMatchObject({
      to: "test@forces.gc.ca",
      cc: ["ally@forces.gc.ca", "second@forces.gc.ca"],
      from: { email: "agent@caf-gpt.com", name: "CAF-GPT" },
      replyTo: "agent@caf-gpt.com",
      subject: "Re: Leave question",
      headers: {
        "X-Agent-Name": "user-agent",
        "X-Agent-ID": getUserAgentId("test@forces.gc.ca"),
        "In-Reply-To": "<msg-1@forces.gc.ca>",
        References: "<root@forces.gc.ca> <parent@forces.gc.ca> <msg-1@forces.gc.ca>",
      },
    });
    const sentHeaders = (result.sentMessages[0] as { headers: Record<string, string> }).headers;
    expect(sentHeaders["X-Agent-Sig"]).toBeTruthy();
    expect(sentHeaders["X-Agent-Sig-Ts"]).toBeTruthy();
    expect(JSON.stringify(result.sentMessages[0])).not.toContain("hidden@forces.gc.ca");
    expect(result.schedules).toEqual([
      [
        1,
        "runMemoryUpdate",
        {
          emailContext: result.primeFooCalls[0][0],
          agentReply: "<p>AI response</p>",
          deliveryFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
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
      to: "pacenote-user@forces.gc.ca",
      cc: ["forwarder@forces.gc.ca"],
    });
  });

  it("generates canonical signed routing and threading headers without Agent.sendEmail", async () => {
    const stub = getUserAgentStub("signed-output@forces.gc.ca");

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
          envelopeFrom: "signed-output@forces.gc.ca",
          envelopeTo: "agent@caf-gpt.com",
          from: "signed-output@forces.gc.ca",
          to: ["agent@caf-gpt.com"],
          subject: "Signed",
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

    expect(result.agentSendCalls).toBe(0);
    expect(result.bindingSendCalls).toBe(1);
    expect(result.delivered.headers).toMatchObject({
      "X-Agent-Name": "user-agent",
      "X-Agent-ID": getUserAgentId("signed-output@forces.gc.ca"),
      "In-Reply-To": "<original@forces.gc.ca>",
      References: "<root@forces.gc.ca> <original@forces.gc.ca>",
    });
    expect(result.delivered.headers["X-Agent-Sig"]).toBeTruthy();
    expect(result.delivered.headers["X-Agent-Sig-Ts"]).toBeTruthy();
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
      const ledger = instance.sql<{ status: string }>`
        SELECT status FROM caf_email_delivery_ledger
      `;
      return {
        replies: getReplyCalls(email),
        structuredSends: bindingSend.mock.calls.length,
        ledger,
      };
    });

    expect(result.structuredSends).toBe(0);
    expect(result.replies).toHaveLength(0);
    expect(result.ledger).toEqual([{ status: "no_response" }]);
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
      return { replies: getReplyCalls(email), structuredSends: bindingSend.mock.calls.length };
    });

    expect(result.structuredSends).toBe(0);
    expect(result.replies).toHaveLength(1);
    expect(result.replies[0][0]).toMatchObject({
      from: "agent@caf-gpt.com",
      to: `${_label}@forces.gc.ca`,
    });
    expect(result.replies[0][0].raw).toContain("Content-Type: text/plain; charset=utf-8");
    expect(result.replies[0][0].raw).not.toContain("multipart/alternative");
    expect(result.replies[0][0].raw).not.toContain("Sensitive inbound body");
    expect(result.replies[0][0].raw).not.toContain("ally@forces.gc.ca");
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
      (instance as unknown as { agentCoordinator: unknown }).agentCoordinator = {
        processWithPrimeFoo,
      };

      await instance.onEmail(email);
      return {
        aiCalls: processWithPrimeFoo.mock.calls.length,
        replies: getReplyCalls(email).length,
      };
    });

    expect(result).toEqual({ aiCalls: 0, replies: 1 });
  });

  it.each([
    ["RFC From", "other@forces.gc.ca", undefined],
    ["Reply-To", "principal@forces.gc.ca", ["delegate@forces.gc.ca"]],
  ])("rejects %s identity that differs from the envelope principal", async (_label, from, replyTo) => {
    const stub = getUserAgentStub("principal@forces.gc.ca");

    const result = await runInDurableObject(stub, async (instance: UserAgent) => {
      const processWithPrimeFoo = vi.fn();
      const email = createAgentEmail({
        envelopeFrom: "principal@forces.gc.ca",
        envelopeTo: "agent@caf-gpt.com",
        from,
        replyTo,
        to: ["agent@caf-gpt.com"],
        subject: "Identity check",
        body: "Body",
        messageId: `<identity-${_label.toLowerCase().replaceAll(" ", "-")}@forces.gc.ca>`,
      });
      (instance as unknown as { agentCoordinator: unknown }).agentCoordinator = {
        processWithPrimeFoo,
      };

      await instance.onEmail(email);
      return { aiCalls: processWithPrimeFoo.mock.calls.length, replies: getReplyCalls(email) };
    });

    expect(result.aiCalls).toBe(0);
    expect(result.replies).toHaveLength(1);
    expect(result.replies[0][0].to).toBe("principal@forces.gc.ca");
  });

  it("suppresses a duplicate malformed message before a second error reply", async () => {
    const stub = getUserAgentStub("encoded-header@forces.gc.ca");

    const result = await runInDurableObject(stub, async (instance: UserAgent) => {
      const email = createAgentEmail({
        envelopeFrom: "encoded-header@forces.gc.ca",
        envelopeTo: "agent@caf-gpt.com",
        from: "encoded-header@forces.gc.ca",
        to: ["agent@caf-gpt.com"],
        subject: "Question",
        body: "Body",
        rawOverride: [
          "From: encoded-header@forces.gc.ca",
          "To: agent@caf-gpt.com",
          "Subject: Question",
          "Message-ID: =?UTF-8?Q?=3Cx@forces.gc.ca=3E=0D=0ABcc:_leak@forces.gc.ca?=",
          "Content-Type: text/plain; charset=utf-8",
          "",
          "Body",
        ].join("\r\n"),
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
        aiCalls: processWithPrimeFoo.mock.calls.length,
        replies: getReplyCalls(email).length,
        rawReads: getRawCalls(email).length,
      };
    });

    expect(result).toEqual({ structuredSends: 0, aiCalls: 0, replies: 1, rawReads: 2 });
  });

  it("suppresses duplicate invocations before AI and outbound delivery", async () => {
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

    expect(result.aiCalls).toBe(1);
    expect(result.sends).toBe(1);
    expect(result.schedules).toHaveLength(1);
    expect(result.schedules[0][3]).toMatchObject({ idempotent: true });
    expect(result.schedules[0][2]).toMatchObject({
      deliveryFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it("does not suppress distinct raw messages with the same envelope and Message-ID", async () => {
    const stub = getUserAgentStub("distinct@forces.gc.ca");

    const result = await runInDurableObject(stub, async (instance: UserAgent) => {
      const processWithPrimeFoo = vi.fn(async () => ({
        shouldRespond: true,
        content: "Response",
      }));
      const bindingSend = vi
        .spyOn(getEmailBinding(instance), "send")
        .mockResolvedValue({ messageId: "reply" });
      vi.spyOn(instance, "schedule").mockResolvedValue({ id: "memory" } as never);
      (instance as unknown as { agentCoordinator: unknown }).agentCoordinator = {
        processWithPrimeFoo,
      };
      const shared = {
        envelopeFrom: "distinct@forces.gc.ca",
        envelopeTo: "agent@caf-gpt.com",
        from: "distinct@forces.gc.ca",
        to: ["agent@caf-gpt.com"],
        subject: "Same metadata",
        messageId: "<same-id@forces.gc.ca>",
      };

      await instance.onEmail(createAgentEmail({ ...shared, body: "First body" }));
      await instance.onEmail(createAgentEmail({ ...shared, body: "Second body" }));

      return {
        aiCalls: processWithPrimeFoo.mock.calls.length,
        sends: bindingSend.mock.calls.length,
      };
    });

    expect(result).toEqual({ aiCalls: 2, sends: 2 });
  });

  it("bounds the durable delivery ledger", async () => {
    const stub = getUserAgentStub("ledger@forces.gc.ca");

    const count = await runInDurableObject(stub, async (instance: UserAgent) => {
      (instance as unknown as { agentCoordinator: unknown }).agentCoordinator = {
        processWithPrimeFoo: vi.fn(async () => ({ shouldRespond: false, content: "" })),
      };

      for (let index = 0; index < 140; index++) {
        await instance.onEmail(
          createAgentEmail({
            envelopeFrom: "ledger@forces.gc.ca",
            envelopeTo: "agent@caf-gpt.com",
            from: "ledger@forces.gc.ca",
            to: ["agent@caf-gpt.com"],
            subject: "Ledger",
            body: `Delivery ${index}`,
            messageId: `<ledger-${index}@forces.gc.ca>`,
          })
        );
      }

      return instance.sql<{ count: number }>`
        SELECT COUNT(*) AS count FROM caf_email_delivery_ledger
      `[0].count;
    });

    expect(count).toBe(128);
  });

  it("expires old delivery ledger entries", async () => {
    const stub = getUserAgentStub("expired-ledger@forces.gc.ca");

    const aiCalls = await runInDurableObject(stub, async (instance: UserAgent) => {
      const email = createAgentEmail({
        envelopeFrom: "expired-ledger@forces.gc.ca",
        envelopeTo: "agent@caf-gpt.com",
        from: "expired-ledger@forces.gc.ca",
        to: ["agent@caf-gpt.com"],
        subject: "Expiry",
        body: "Same delivery after retention window",
        messageId: "<expired-ledger@forces.gc.ca>",
      });
      const processWithPrimeFoo = vi.fn(async () => ({ shouldRespond: false, content: "" }));
      (instance as unknown as { agentCoordinator: unknown }).agentCoordinator = {
        processWithPrimeFoo,
      };

      await instance.onEmail(email);
      instance.sql`
        UPDATE caf_email_delivery_ledger
        SET updated_at = ${Date.now() - 31 * 24 * 60 * 60 * 1000}
      `;
      await instance.onEmail(email);
      return processWithPrimeFoo.mock.calls.length;
    });

    expect(aiCalls).toBe(2);
  });

  it("deduplicates raw-read failures before a second fallback error reply", async () => {
    const stub = getUserAgentStub("parse@forces.gc.ca");

    const replies = await runInDurableObject(stub, async (instance: UserAgent) => {
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

      await instance.onEmail(email);
      await instance.onEmail(email);
      return { replies: getReplyCalls(email), rawReads: getRawCalls(email).length };
    });

    expect(replies.replies).toHaveLength(1);
    expect(replies.replies[0][0].to).toBe("parse@forces.gc.ca");
    expect(replies.rawReads).toBe(2);
  });

  it("keeps an ambiguous structured-send failure terminal without a second reply", async () => {
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
      const ledger = instance.sql<{ status: string }>`
        SELECT status FROM caf_email_delivery_ledger
      `;
      return {
        schedules: schedule.mock.calls.length,
        replies: getReplyCalls(email).length,
        ledger,
      };
    });

    expect(result).toEqual({ schedules: 0, replies: 0, ledger: [{ status: "send_unknown" }] });
  });

  it("treats signing failure as deterministic pre-send and sends one terminal error reply", async () => {
    const stub = getUserAgentStub("signing-failure@forces.gc.ca");

    const result = await runInDurableObject(stub, async (instance: UserAgent) => {
      const email = createAgentEmail({
        envelopeFrom: "signing-failure@forces.gc.ca",
        envelopeTo: "agent@caf-gpt.com",
        from: "signing-failure@forces.gc.ca",
        to: ["agent@caf-gpt.com", "ally@forces.gc.ca"],
        cc: ["second@forces.gc.ca"],
        subject: "Question",
        body: "Body",
        messageId: "<signing-failure@forces.gc.ca>",
      });
      const bindingSend = vi.spyOn(getEmailBinding(instance), "send");
      vi.spyOn(crypto.subtle, "importKey").mockRejectedValueOnce(new Error("signing unavailable"));
      (instance as unknown as { agentCoordinator: unknown }).agentCoordinator = {
        processWithPrimeFoo: vi.fn(async () => ({ shouldRespond: true, content: "Response" })),
      };

      await instance.onEmail(email);
      const ledger = instance.sql<{ status: string }>`
        SELECT status FROM caf_email_delivery_ledger
      `;
      return {
        replies: getReplyCalls(email),
        structuredSends: bindingSend.mock.calls.length,
        ledger,
      };
    });

    expect(result.structuredSends).toBe(0);
    expect(result.replies).toHaveLength(1);
    expect(result.replies[0][0]).toMatchObject({
      from: "agent@caf-gpt.com",
      to: "signing-failure@forces.gc.ca",
    });
    expect(result.ledger).toEqual([{ status: "error_replied" }]);
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
        replyFailure: new Error("reply rejected"),
      });
      (instance as unknown as { agentCoordinator: unknown }).agentCoordinator = {
        processWithPrimeFoo: vi.fn(async () => {
          throw new Error("model down");
        }),
      };

      await expect(instance.onEmail(email)).resolves.toBeUndefined();
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
        deliveryFingerprint: "memory-success",
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
          deliveryFingerprint: "memory-failure",
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
