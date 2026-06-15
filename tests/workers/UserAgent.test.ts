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
import { Logger } from "../../src/Logger";

afterEach(async () => {
  vi.restoreAllMocks();
  await reset();
});

describe("UserAgent email routing", () => {
  it("routes authorized direct mail to a full-email UserAgent id", async () => {
    const warn = vi.spyOn(Logger.getInstance(), "warn");
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
    expect(warn).not.toHaveBeenCalled();
  });

  it("routes signed replies with kebab-case agent names before direct sender routing", async () => {
    const resolver = createUserAgentResolver(env);
    const signedHeaders = await signAgentHeaders(env.EMAIL_SECRET, "user-agent", "signed-agent-id");
    const message = createRoutingMessage({
      from: "test@forces.gc.ca",
      to: "agent@caf-gpt.com",
      headers: signedHeaders,
    });

    const route = await resolver(message, env);

    expect(route).toEqual({
      agentName: "user-agent",
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
  it("sends a signed sender-only inbound reply and schedules memory update", async () => {
    const stub = getUserAgentStub("test@forces.gc.ca");

    const result = await runInDurableObject(stub, async (instance: UserAgent) => {
      const schedules: unknown[][] = [];
      const processWithPrimeFoo = vi.fn(async (_context: string, memory?: string) => ({
        shouldRespond: true,
        content: "<p>AI response</p>",
        memory,
      }));
      const email = createAgentEmail({
        from: "test@forces.gc.ca",
        to: "agent@caf-gpt.com",
        cc: ["ally@forces.gc.ca", "outsider@example.com"],
        subject: "Leave question",
        body: "Can I take annual leave next week?",
        messageId: "<msg-1@forces.gc.ca>",
        headers: { references: "<root@forces.gc.ca> <parent@forces.gc.ca>" },
      });

      instance.setState({ memory: "remembered preference" });
      vi.spyOn(instance, "schedule").mockImplementation(async (...args) => {
        schedules.push(args);
        return { id: "schedule-1" } as never;
      });
      (instance as unknown as { agentCoordinator: unknown }).agentCoordinator = {
        processWithPrimeFoo,
      };

      await instance.onEmail(email);

      return {
        replyCalls: getReplyCalls(email),
        schedules,
        primeFooCalls: processWithPrimeFoo.mock.calls,
      };
    });

    expect(result.primeFooCalls[0][1]).toBe("remembered preference");
    expect(result.replyCalls).toHaveLength(1);
    const reply = result.replyCalls[0][0];
    expect(reply).toMatchObject({
      from: "agent@caf-gpt.com",
      to: "test@forces.gc.ca",
    });
    expect(reply.raw).toContain('From: "CAF-GPT" <agent@caf-gpt.com>');
    expect(reply.raw).toContain("To: <test@forces.gc.ca>");
    expect(reply.raw).toContain("Subject: Re: Leave question");
    expect(reply.raw).toContain("In-Reply-To: <msg-1@forces.gc.ca>");
    expect(reply.raw).toContain(
      "References: <root@forces.gc.ca> <parent@forces.gc.ca> <msg-1@forces.gc.ca>"
    );
    expect(reply.raw).toContain("X-Agent-Name: user-agent");
    expect(reply.raw).toContain(`X-Agent-ID: ${getUserAgentId("test@forces.gc.ca")}`);
    expect(reply.raw).toContain("X-Agent-Sig:");
    expect(reply.raw).toContain("Content-Type: multipart/alternative;");
    expect(reply.raw).toContain("<p>AI response</p>");
    expect(result.schedules[0][1]).toBe("runMemoryUpdate");
  });

  it("sends direct pacenote replies from the inbound pacenote alias", async () => {
    const stub = getUserAgentStub("pacenote-user@forces.gc.ca");

    const result = await runInDurableObject(stub, async (instance: UserAgent) => {
      const processWithPrimeFoo = vi.fn(async () => ({
        shouldRespond: true,
        content: "<p>Feedback note</p>",
      }));
      const email = createAgentEmail({
        from: "pacenote-user@forces.gc.ca",
        to: "pacenote@caf-gpt.com",
        subject: "Feedback note",
        body: "Write a feedback note.",
        messageId: "<pacenote-1@forces.gc.ca>",
      });

      vi.spyOn(instance, "schedule").mockResolvedValue({ id: "schedule-1" } as never);
      (instance as unknown as { agentCoordinator: unknown }).agentCoordinator = {
        processWithPrimeFoo,
      };

      await instance.onEmail(email);

      return { replyCalls: getReplyCalls(email) };
    });

    expect(result.replyCalls).toHaveLength(1);
    const reply = result.replyCalls[0][0];
    expect(reply).toMatchObject({
      from: "pacenote@caf-gpt.com",
      to: "pacenote-user@forces.gc.ca",
    });
    expect(reply.raw).toContain('From: "CAF-GPT" <pacenote@caf-gpt.com>');
    expect(reply.raw).toContain("To: <pacenote-user@forces.gc.ca>");
    expect(reply.raw).toContain("Subject: Re: Feedback note");
    expect(reply.raw).toContain("In-Reply-To: <pacenote-1@forces.gc.ca>");
    expect(reply.raw).toContain("X-Agent-Name: user-agent");
  });

  it("sends pacenote error responses from the inbound pacenote alias", async () => {
    const stub = getUserAgentStub("pacenote-error@forces.gc.ca");

    const result = await runInDurableObject(stub, async (instance: UserAgent) => {
      const processWithPrimeFoo = vi.fn(async () => {
        throw new Error("model down");
      });
      let thrownMessage = "";
      const email = createAgentEmail({
        from: "pacenote-error@forces.gc.ca",
        to: "pacenote@caf-gpt.com",
        subject: "Feedback note",
        body: "Write a feedback note.",
        messageId: "<pacenote-error-1@forces.gc.ca>",
      });

      (instance as unknown as { agentCoordinator: unknown }).agentCoordinator = {
        processWithPrimeFoo,
      };

      try {
        await instance.onEmail(email);
      } catch (error) {
        thrownMessage = error instanceof Error ? error.message : String(error);
      }

      return { replyCalls: getReplyCalls(email), thrownMessage };
    });

    expect(result.thrownMessage).toBe("model down");
    expect(result.replyCalls).toHaveLength(1);
    const reply = result.replyCalls[0][0];
    expect(reply).toMatchObject({
      from: "pacenote@caf-gpt.com",
      to: "pacenote-error@forces.gc.ca",
    });
    expect(reply.raw).toContain('From: "CAF-GPT" <pacenote@caf-gpt.com>');
    expect(reply.raw).toContain("To: <pacenote-error@forces.gc.ca>");
    expect(reply.raw).toContain("Subject: Error Processing Email");
    expect(reply.raw).toContain("In-Reply-To: <pacenote-error-1@forces.gc.ca>");
    expect(reply.raw).toContain("Content-Type: text/plain; charset=utf-8");
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
    reply: vi.fn(async () => ({ messageId: "mock-reply" })),
  };
}

function getReplyCalls(email: AgentEmail): Array<[Parameters<AgentEmail["reply"]>[0]]> {
  return (
    email.reply as unknown as {
      mock: { calls: Array<[Parameters<AgentEmail["reply"]>[0]]> };
    }
  ).mock.calls;
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
