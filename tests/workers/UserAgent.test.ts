/**
 * tests/workers/UserAgent.test.ts
 *
 * Workers runtime integration tests for the UserAgent Durable Object
 *
 * Top-level declarations:
 * - UserAgent Workers test suite: Verifies routing, signed replies, and Agent state memory updates
 */

/// <reference types="@cloudflare/vitest-pool-workers/types" />

import { reset, runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { type AgentEmail, signAgentHeaders } from "agents/email";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryFooAgent } from "../../src/agents/sub-agents";
import { getUserAgentId, type UserAgent } from "../../src/agents/UserAgent";
import { createUserAgentResolver } from "../../src/index";

afterEach(async () => {
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

    const route = await resolver(message, env);

    expect(route).toEqual({
      agentName: "UserAgent",
      agentId: getUserAgentId("test@forces.gc.ca"),
    });
  });

  it("routes signed replies before falling back to direct sender routing", async () => {
    const resolver = createUserAgentResolver(env);
    const signedHeaders = await signAgentHeaders(env.EMAIL_SECRET, "UserAgent", "signed-agent-id");
    const message = createRoutingMessage({
      from: "test@forces.gc.ca",
      to: "agent@caf-gpt.com",
      headers: signedHeaders,
    });

    const route = await resolver(message, env);

    expect(route).toEqual({
      agentName: "UserAgent",
      agentId: "signed-agent-id",
      _secureRouted: true,
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
});

describe("UserAgent email processing", () => {
  it("sends a signed reply with safe CC recipients and schedules memory update", async () => {
    const stub = getUserAgentStub("test@forces.gc.ca");

    const result = await runInDurableObject(stub, async (instance: UserAgent) => {
      const sentMessages: unknown[] = [];
      const schedules: unknown[][] = [];
      const processWithPrimeFoo = vi.fn(async (_context: string, memory?: string) => ({
        shouldRespond: true,
        content: "<p>AI response</p>",
        memory,
      }));

      instance.setState({ memory: "remembered preference" });
      vi.spyOn(instance, "sendEmail").mockImplementation(async (options) => {
        sentMessages.push(options);
        return { messageId: "reply-1" };
      });
      vi.spyOn(instance, "schedule").mockImplementation(async (...args) => {
        schedules.push(args);
        return { id: "schedule-1" } as never;
      });
      (instance as unknown as { agentCoordinator: unknown }).agentCoordinator = {
        processWithPrimeFoo,
      };

      await instance.onEmail(
        createAgentEmail({
          from: "test@forces.gc.ca",
          to: "agent@caf-gpt.com",
          cc: ["ally@forces.gc.ca", "outsider@example.com"],
          subject: "Leave question",
          body: "Can I take annual leave next week?",
          messageId: "<msg-1@forces.gc.ca>",
          headers: { references: "<root@forces.gc.ca> <parent@forces.gc.ca>" },
        })
      );

      return {
        sentMessages,
        schedules,
        primeFooCalls: processWithPrimeFoo.mock.calls,
      };
    });

    expect(result.primeFooCalls[0][1]).toBe("remembered preference");
    expect(result.sentMessages).toHaveLength(1);
    expect(result.sentMessages[0]).toMatchObject({
      to: "test@forces.gc.ca",
      cc: ["ally@forces.gc.ca"],
      from: { email: "agent@caf-gpt.com", name: "CAF-GPT" },
      replyTo: "agent@caf-gpt.com",
      subject: "Re: Leave question",
      inReplyTo: "<msg-1@forces.gc.ca>",
      headers: { References: "<root@forces.gc.ca> <parent@forces.gc.ca> <msg-1@forces.gc.ca>" },
      secret: env.EMAIL_SECRET,
    });
    expect(result.schedules[0][1]).toBe("runMemoryUpdate");
  });

  it("sends direct pacenote replies from the inbound pacenote alias", async () => {
    const stub = getUserAgentStub("pacenote-user@forces.gc.ca");

    const result = await runInDurableObject(stub, async (instance: UserAgent) => {
      const sentMessages: unknown[] = [];
      const processWithPrimeFoo = vi.fn(async () => ({
        shouldRespond: true,
        content: "<p>Feedback note</p>",
      }));

      vi.spyOn(instance, "sendEmail").mockImplementation(async (options) => {
        sentMessages.push(options);
        return { messageId: "reply-1" };
      });
      vi.spyOn(instance, "schedule").mockResolvedValue({ id: "schedule-1" } as never);
      (instance as unknown as { agentCoordinator: unknown }).agentCoordinator = {
        processWithPrimeFoo,
      };

      await instance.onEmail(
        createAgentEmail({
          from: "pacenote-user@forces.gc.ca",
          to: "pacenote@caf-gpt.com",
          subject: "Feedback note",
          body: "Write a feedback note.",
          messageId: "<pacenote-1@forces.gc.ca>",
        })
      );

      return { sentMessages };
    });

    expect(result.sentMessages).toHaveLength(1);
    expect(result.sentMessages[0]).toMatchObject({
      to: "pacenote-user@forces.gc.ca",
      from: { email: "pacenote@caf-gpt.com", name: "CAF-GPT" },
      replyTo: "pacenote@caf-gpt.com",
      subject: "Re: Feedback note",
      inReplyTo: "<pacenote-1@forces.gc.ca>",
      secret: env.EMAIL_SECRET,
    });
  });

  it("sends pacenote error responses from the inbound pacenote alias", async () => {
    const stub = getUserAgentStub("pacenote-error@forces.gc.ca");

    const result = await runInDurableObject(stub, async (instance: UserAgent) => {
      const sentMessages: unknown[] = [];
      const processWithPrimeFoo = vi.fn(async () => {
        throw new Error("model down");
      });
      let thrownMessage = "";

      vi.spyOn(instance, "sendEmail").mockImplementation(async (options) => {
        sentMessages.push(options);
        return { messageId: "error-1" };
      });
      (instance as unknown as { agentCoordinator: unknown }).agentCoordinator = {
        processWithPrimeFoo,
      };

      try {
        await instance.onEmail(
          createAgentEmail({
            from: "pacenote-error@forces.gc.ca",
            to: "pacenote@caf-gpt.com",
            subject: "Feedback note",
            body: "Write a feedback note.",
            messageId: "<pacenote-error-1@forces.gc.ca>",
          })
        );
      } catch (error) {
        thrownMessage = error instanceof Error ? error.message : String(error);
      }

      return { sentMessages, thrownMessage };
    });

    expect(result.thrownMessage).toBe("model down");
    expect(result.sentMessages).toHaveLength(1);
    expect(result.sentMessages[0]).toMatchObject({
      to: "pacenote-error@forces.gc.ca",
      from: { email: "pacenote@caf-gpt.com", name: "CAF-GPT" },
      replyTo: "pacenote@caf-gpt.com",
      subject: "Error Processing Email",
      inReplyTo: "<pacenote-error-1@forces.gc.ca>",
      secret: env.EMAIL_SECRET,
    });
  });

  it("does not process self-loop emails", async () => {
    const stub = getUserAgentStub("agent@caf-gpt.com");

    const result = await runInDurableObject(stub, async (instance: UserAgent) => {
      const processWithPrimeFoo = vi.fn(async () => ({
        shouldRespond: true,
        content: "should not send",
      }));
      (instance as unknown as { agentCoordinator: unknown }).agentCoordinator = {
        processWithPrimeFoo,
      };

      await instance.onEmail(
        createAgentEmail({
          from: "agent@caf-gpt.com",
          to: "agent@caf-gpt.com",
          subject: "Loop",
          body: "Loop body",
          messageId: "<loop@caf-gpt.com>",
        })
      );

      return processWithPrimeFoo.mock.calls.length;
    });

    expect(result).toBe(0);
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
      ).rejects.toThrow("transient model failure");
    });
  });
});

function getUserAgentStub(senderEmail: string): DurableObjectStub<UserAgent> {
  return env.UserAgent.get(env.UserAgent.idFromName(getUserAgentId(senderEmail)));
}

function createAgentEmail(options: {
  from: string;
  to: string;
  cc?: string[];
  subject: string;
  body: string;
  messageId: string;
  headers?: Record<string, string>;
}): AgentEmail {
  const raw = buildRawEmail(options);
  const headers = new Headers({
    from: options.from,
    to: options.to,
    ...(options.cc?.length ? { cc: options.cc.join(", ") } : {}),
    subject: options.subject,
    "message-id": options.messageId,
    ...options.headers,
  });

  return {
    from: options.from,
    to: options.to,
    headers,
    rawSize: raw.length,
    getRaw: async () => new TextEncoder().encode(raw),
    setReject: vi.fn(),
    forward: vi.fn(),
    reply: vi.fn(),
  };
}

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

function buildRawEmail(options: {
  from: string;
  to: string;
  cc?: string[];
  subject: string;
  body: string;
  messageId: string;
}): string {
  const headers = [
    `From: ${options.from}`,
    `To: ${options.to}`,
    ...(options.cc?.length ? [`Cc: ${options.cc.join(", ")}`] : []),
    `Subject: ${options.subject}`,
    `Message-ID: ${options.messageId}`,
    "Content-Type: text/plain; charset=utf-8",
  ];

  return `${headers.join("\r\n")}\r\n\r\n${options.body}`;
}
