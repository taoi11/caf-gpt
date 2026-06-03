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
      subject: "Re: Leave question",
      inReplyTo: "<msg-1@forces.gc.ca>",
      secret: env.EMAIL_SECRET,
    });
    expect(result.schedules[0][1]).toBe("runMemoryUpdate");
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
