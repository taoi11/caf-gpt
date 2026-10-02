/**
 * tests/workers/ClefNoReplyGate.test.ts
 *
 * Workers tests for the Clef-flash no_reply gate in UserAgent.getAIResponse
 */

/// <reference types="@cloudflare/vitest-pool-workers/types" />

import { reset, runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import type { AgentEmail } from "agents/email";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentCoordinator } from "../../src/agents/AgentCoordinator";
import { CLEF_FLASH_MODEL } from "../../src/agents/utils/ClefDecision";
import { getUserAgentId, type UserAgent } from "../../src/agents/UserAgent";

afterEach(async () => {
  vi.restoreAllMocks();
  await reset();
});

describe("UserAgent Clef no_reply gate", () => {
  it("skips Prime Foo and does not send when Clef chooses no_reply", async () => {
    const stub = getUserAgentStub("clef-no-reply@forces.gc.ca");

    const result = await runInDurableObject(stub, async (instance: UserAgent) => {
      const processWithPrimeFoo = vi.fn<AgentCoordinator["processWithPrimeFoo"]>(async () => ({
        shouldRespond: true,
        content: "<p>should not send</p>",
      }));
      vi.spyOn(AgentCoordinator.prototype, "processWithPrimeFoo").mockImplementation(
        processWithPrimeFoo
      );

      mockClefChoice("no_reply", 0.93);

      const email = createAgentEmail({
        envelopeFrom: "clef-no-reply@forces.gc.ca",
        envelopeTo: "agent@caf-gpt.com",
        from: "clef-no-reply@forces.gc.ca",
        to: ["agent@caf-gpt.com"],
        subject: "Thanks",
        body: "Thanks!",
        messageId: "<clef-no-reply@forces.gc.ca>",
      });
      const bindingSend = vi.spyOn(getEmailBinding(instance), "send");

      await instance.onEmail(email);
      return {
        primeFooCalls: processWithPrimeFoo.mock.calls.length,
        structuredSends: bindingSend.mock.calls.length,
        replies: email.reply.mock.calls.length,
      };
    });

    expect(result).toEqual({ primeFooCalls: 0, structuredSends: 0, replies: 0 });
  });

  it("propagates Clef AI.run outages to the onEmail error boundary", async () => {
    const stub = getUserAgentStub("clef-error@forces.gc.ca");

    const result = await runInDurableObject(stub, async (instance: UserAgent) => {
      const processWithPrimeFoo = vi.fn<AgentCoordinator["processWithPrimeFoo"]>(async () => ({
        shouldRespond: true,
        content: "<p>should not send</p>",
      }));
      vi.spyOn(AgentCoordinator.prototype, "processWithPrimeFoo").mockImplementation(
        processWithPrimeFoo
      );

      const ai = env.AI as { run: (...args: unknown[]) => Promise<unknown> };
      vi.spyOn(ai, "run").mockImplementation(async (model: unknown) => {
        if (model === CLEF_FLASH_MODEL) {
          throw new Error("workers ai down");
        }
        throw new Error(`Unexpected AI.run model: ${String(model)}`);
      });

      const email = createAgentEmail({
        envelopeFrom: "clef-error@forces.gc.ca",
        envelopeTo: "agent@caf-gpt.com",
        from: "clef-error@forces.gc.ca",
        to: ["agent@caf-gpt.com"],
        subject: "Question",
        body: "Body",
        messageId: "<clef-error@forces.gc.ca>",
      });
      const bindingSend = vi.spyOn(getEmailBinding(instance), "send");

      await instance.onEmail(email);
      return {
        primeFooCalls: processWithPrimeFoo.mock.calls.length,
        structuredSends: bindingSend.mock.calls,
        replies: email.reply.mock.calls.length,
      };
    });

    expect(result.primeFooCalls).toBe(0);
    expect(result.replies).toBe(0);
    expect(result.structuredSends).toHaveLength(1);
    expect(result.structuredSends[0][0]).toMatchObject({
      to: "clef-error@forces.gc.ca",
      subject: "Error Processing Email",
    });
  });

  it("silently drops valid no_reply before recipient resolution errors", async () => {
    const stub = getUserAgentStub("clef-many-rcpt@forces.gc.ca");
    const manyRecipients = Array.from({ length: 51 }, (_, i) => `user${i}@forces.gc.ca`);

    const result = await runInDurableObject(stub, async (instance: UserAgent) => {
      const processWithPrimeFoo = vi.fn<AgentCoordinator["processWithPrimeFoo"]>(async () => ({
        shouldRespond: true,
        content: "<p>should not send</p>",
      }));
      vi.spyOn(AgentCoordinator.prototype, "processWithPrimeFoo").mockImplementation(
        processWithPrimeFoo
      );
      mockClefChoice("no_reply", 0.95);

      const email = createAgentEmail({
        envelopeFrom: "clef-many-rcpt@forces.gc.ca",
        envelopeTo: "agent@caf-gpt.com",
        from: "clef-many-rcpt@forces.gc.ca",
        to: ["agent@caf-gpt.com", ...manyRecipients],
        subject: "FYI",
        body: "Thanks everyone!",
        messageId: "<clef-many-rcpt@forces.gc.ca>",
      });
      const bindingSend = vi.spyOn(getEmailBinding(instance), "send");

      await instance.onEmail(email);
      return {
        primeFooCalls: processWithPrimeFoo.mock.calls.length,
        structuredSends: bindingSend.mock.calls.length,
        replies: email.reply.mock.calls.length,
      };
    });

    expect(result).toEqual({ primeFooCalls: 0, structuredSends: 0, replies: 0 });
  });

  it("passes user memory into the Clef gate state", async () => {
    const stub = getUserAgentStub("clef-memory@forces.gc.ca");

    const result = await runInDurableObject(stub, async (instance: UserAgent) => {
      instance.setState({
        memory: "User previously asked to draft a leave request.",
        versions: [],
      });

      const processWithPrimeFoo = vi.fn<AgentCoordinator["processWithPrimeFoo"]>(async () => ({
        shouldRespond: true,
        content: "<p>drafted</p>",
      }));
      vi.spyOn(AgentCoordinator.prototype, "processWithPrimeFoo").mockImplementation(
        processWithPrimeFoo
      );

      const ai = env.AI as { run: (...args: unknown[]) => Promise<unknown> };
      const runSpy = vi.spyOn(ai, "run").mockImplementation(async (model: unknown) => {
        if (model === CLEF_FLASH_MODEL) {
          return {
            model: "clef-flash",
            answers: {
              should_reply: {
                type: "choice",
                choice: "reply",
                confidence: 0.92,
                probabilities: { reply: 0.92, no_reply: 0.08 },
              },
            },
            usage: { input_tokens: 1, output_tokens: 1 },
          };
        }
        throw new Error(`Unexpected AI.run model: ${String(model)}`);
      });

      vi.spyOn(instance, "schedule").mockResolvedValue({
        id: "schedule-1",
        callback: "runMemoryUpdate",
        payload: "",
        type: "delayed",
        time: 1,
        delayInSeconds: 1,
      } as never);

      const email = createAgentEmail({
        envelopeFrom: "clef-memory@forces.gc.ca",
        envelopeTo: "agent@caf-gpt.com",
        from: "clef-memory@forces.gc.ca",
        to: ["agent@caf-gpt.com"],
        subject: "Re: Leave",
        body: "Yes, please",
        messageId: "<clef-memory@forces.gc.ca>",
      });
      vi.spyOn(getEmailBinding(instance), "send").mockResolvedValue({
        messageId: "structured-reply",
      });

      await instance.onEmail(email);
      const clefCall = runSpy.mock.calls.find((call) => call[0] === CLEF_FLASH_MODEL);
      const inputs = clefCall?.[1] as { state?: string } | undefined;
      return {
        primeFooCalls: processWithPrimeFoo.mock.calls.length,
        stateIncludesMemory: Boolean(inputs?.state?.includes("<memory>")),
        stateIncludesPriorAsk: Boolean(
          inputs?.state?.includes("User previously asked to draft a leave request.")
        ),
        stateIncludesBody: Boolean(inputs?.state?.includes("Yes, please")),
      };
    });

    expect(result).toEqual({
      primeFooCalls: 1,
      stateIncludesMemory: true,
      stateIncludesPriorAsk: true,
      stateIncludesBody: true,
    });
  });

  it("continues to Prime Foo when Clef chooses reply with high confidence", async () => {
    const stub = getUserAgentStub("clef-reply@forces.gc.ca");

    const result = await runInDurableObject(stub, async (instance: UserAgent) => {
      const processWithPrimeFoo = vi.fn<AgentCoordinator["processWithPrimeFoo"]>(async () => ({
        shouldRespond: true,
        content: "<p>AI response</p>",
      }));
      vi.spyOn(AgentCoordinator.prototype, "processWithPrimeFoo").mockImplementation(
        processWithPrimeFoo
      );
      mockClefChoice("reply", 0.91);
      vi.spyOn(instance, "schedule").mockResolvedValue({
        id: "schedule-1",
        callback: "runMemoryUpdate",
        payload: "",
        type: "delayed",
        time: 1,
        delayInSeconds: 1,
      } as never);

      const email = createAgentEmail({
        envelopeFrom: "clef-reply@forces.gc.ca",
        envelopeTo: "agent@caf-gpt.com",
        from: "clef-reply@forces.gc.ca",
        to: ["agent@caf-gpt.com"],
        subject: "Leave question",
        body: "Can I take leave?",
        messageId: "<clef-reply@forces.gc.ca>",
      });
      const bindingSend = vi
        .spyOn(getEmailBinding(instance), "send")
        .mockResolvedValue({ messageId: "structured-reply" });

      await instance.onEmail(email);
      return {
        primeFooCalls: processWithPrimeFoo.mock.calls.length,
        structuredSends: bindingSend.mock.calls.length,
      };
    });

    expect(result).toEqual({ primeFooCalls: 1, structuredSends: 1 });
  });
});

function mockClefChoice(choice: "reply" | "no_reply", confidence: number): void {
  const ai = env.AI as { run: (...args: unknown[]) => Promise<unknown> };
  vi.spyOn(ai, "run").mockImplementation(async (model: unknown) => {
    if (model === CLEF_FLASH_MODEL) {
      return {
        model: "clef-flash",
        answers: {
          should_reply: {
            type: "choice",
            choice,
            confidence,
            probabilities: {
              reply: choice === "reply" ? confidence : 1 - confidence,
              no_reply: choice === "no_reply" ? confidence : 1 - confidence,
            },
          },
        },
        usage: { input_tokens: 1, output_tokens: 1 },
      };
    }
    throw new Error(`Unexpected AI.run model: ${String(model)}`);
  });
}

function getUserAgentStub(senderEmail: string) {
  return env.UserAgent.get(env.UserAgent.idFromName(getUserAgentId(senderEmail)));
}

function getEmailBinding(instance: UserAgent): Env["EMAIL"] {
  const runtimeAccess = instance as UserAgent & { env: Env };
  return runtimeAccess.env.EMAIL;
}

interface AgentEmailOptions {
  envelopeFrom: string;
  envelopeTo: string;
  from: string;
  to: string[];
  subject: string;
  body: string;
  messageId?: string;
}

type MockAgentEmail = AgentEmail & {
  reply: ReturnType<typeof vi.fn<AgentEmail["reply"]>>;
};

function createAgentEmail(options: AgentEmailOptions): MockAgentEmail {
  const raw = [
    `From: ${options.from}`,
    `To: ${options.to.join(", ")}`,
    `Subject: ${options.subject}`,
    ...(options.messageId ? [`Message-ID: ${options.messageId}`] : []),
    "Content-Type: text/plain; charset=utf-8",
    "",
    options.body,
  ].join("\r\n");

  return {
    from: options.envelopeFrom,
    to: options.envelopeTo,
    headers: new Headers({
      from: options.from,
      to: options.to.join(", "),
      subject: options.subject,
      ...(options.messageId ? { "message-id": options.messageId } : {}),
    }),
    rawSize: raw.length,
    getRaw: vi.fn(async () => new TextEncoder().encode(raw)),
    setReject: vi.fn(),
    forward: vi.fn(),
    reply: vi.fn(async () => ({ messageId: "mock-reply" })),
  };
}
