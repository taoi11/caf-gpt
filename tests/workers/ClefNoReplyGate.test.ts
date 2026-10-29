/**
 * tests/workers/ClefNoReplyGate.test.ts
 *
 * Workers tests for the Clef (27B) prompt-injection/abuse screen in UserAgent.getAIResponse
 *
 * Top-level declarations:
 * - mockClefChoice: Mocks env.AI.run to return a Clef reply/no_reply choice
 * - getUserAgentStub: Gets a per-sender UserAgent Durable Object stub
 *
 * Inbound email and Resend API calls come from tests/workers/resendHarness (mocked fetch only).
 */

/// <reference types="@cloudflare/vitest-pool-workers/types" />

import { reset, runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentCoordinator } from "../../src/agents/AgentCoordinator";
import { type ClefAiRunner, CLEF_MODEL } from "../../src/agents/utils/ClefDecision";
import { getUserAgentId, type UserAgent } from "../../src/agents/UserAgent";
import { createInboundEmail, installResendMock } from "./resendHarness";

afterEach(async () => {
  vi.restoreAllMocks();
  await reset();
});

describe("UserAgent Clef injection screen", () => {
  it("skips Prime Foo and does not send when Clef chooses no_reply", async () => {
    const stub = getUserAgentStub("clef-no-reply@forces.gc.ca");

    const result = await runInDurableObject(stub, async (instance: UserAgent) => {
      const resend = installResendMock();

      const processWithPrimeFoo = vi.fn<AgentCoordinator["processWithPrimeFoo"]>(async () => ({
        shouldRespond: true,
        content: "<p>should not send</p>",
      }));

      vi.spyOn(AgentCoordinator.prototype, "processWithPrimeFoo").mockImplementation(
        processWithPrimeFoo
      );

      mockClefChoice("no_reply", 0.93);

      const email = createInboundEmail({
        envelopeFrom: "clef-no-reply@forces.gc.ca",
        envelopeTo: "agent@caf-gpt.com",
        from: "clef-no-reply@forces.gc.ca",
        to: ["agent@caf-gpt.com"],
        subject: "Thanks",
        body: "Thanks!",
        messageId: "<clef-no-reply@forces.gc.ca>",
      });

      await resend.deliver(instance, email);

      return {
        primeFooCalls: processWithPrimeFoo.mock.calls.length,
        structuredSends: resend.replies.length,
      };
    });

    expect(result).toEqual({ primeFooCalls: 0, structuredSends: 0 });
  });

  it("propagates Clef AI.run outages to the processing error boundary", async () => {
    const stub = getUserAgentStub("clef-error@forces.gc.ca");

    const result = await runInDurableObject(stub, async (instance: UserAgent) => {
      const resend = installResendMock();

      const processWithPrimeFoo = vi.fn<AgentCoordinator["processWithPrimeFoo"]>(async () => ({
        shouldRespond: true,
        content: "<p>should not send</p>",
      }));

      vi.spyOn(AgentCoordinator.prototype, "processWithPrimeFoo").mockImplementation(
        processWithPrimeFoo
      );

      // SAFETY: These tests intercept only the Clef request contract missing from generated AiModels.
      const ai = env.AI as ClefAiRunner;
      vi.spyOn(ai, "run").mockImplementation(async (model: string) => {
        if (model === CLEF_MODEL) {
          throw new Error("workers ai down");
        }

        throw new Error(`Unexpected AI.run model: ${String(model)}`);
      });

      const email = createInboundEmail({
        envelopeFrom: "clef-error@forces.gc.ca",
        envelopeTo: "agent@caf-gpt.com",
        from: "clef-error@forces.gc.ca",
        to: ["agent@caf-gpt.com"],
        subject: "Question",
        body: "Body",
        messageId: "<clef-error@forces.gc.ca>",
      });

      await resend.deliver(instance, email);

      return {
        primeFooCalls: processWithPrimeFoo.mock.calls.length,
        structuredSends: resend.replies,
      };
    });

    expect(result.primeFooCalls).toBe(0);
    expect(result.structuredSends).toHaveLength(1);
    expect(result.structuredSends[0].body).toMatchObject({
      subject: "Error Processing Email",
      reply_all: false,
    });
  });

  it("silently drops valid no_reply before recipient resolution errors", async () => {
    const stub = getUserAgentStub("clef-many-rcpt@forces.gc.ca");
    const manyRecipients = Array.from({ length: 51 }, (_, i) => `user${i}@forces.gc.ca`);

    const result = await runInDurableObject(stub, async (instance: UserAgent) => {
      const resend = installResendMock();

      const processWithPrimeFoo = vi.fn<AgentCoordinator["processWithPrimeFoo"]>(async () => ({
        shouldRespond: true,
        content: "<p>should not send</p>",
      }));

      vi.spyOn(AgentCoordinator.prototype, "processWithPrimeFoo").mockImplementation(
        processWithPrimeFoo
      );
      mockClefChoice("no_reply", 0.95);

      const email = createInboundEmail({
        envelopeFrom: "clef-many-rcpt@forces.gc.ca",
        envelopeTo: "agent@caf-gpt.com",
        from: "clef-many-rcpt@forces.gc.ca",
        to: ["agent@caf-gpt.com", ...manyRecipients],
        subject: "FYI",
        body: "Thanks everyone!",
        messageId: "<clef-many-rcpt@forces.gc.ca>",
      });

      await resend.deliver(instance, email);

      return {
        primeFooCalls: processWithPrimeFoo.mock.calls.length,
        structuredSends: resend.replies.length,
      };
    });

    expect(result).toEqual({ primeFooCalls: 0, structuredSends: 0 });
  });

  it("passes user memory into the Clef gate state", async () => {
    const stub = getUserAgentStub("clef-memory@forces.gc.ca");

    const result = await runInDurableObject(stub, async (instance: UserAgent) => {
      const resend = installResendMock();
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

      // SAFETY: These tests intercept only the Clef request contract missing from generated AiModels.
      const ai = env.AI as ClefAiRunner;

      const runSpy = vi.spyOn(ai, "run").mockImplementation(async (model: string) => {
        if (model === CLEF_MODEL) {
          return {
            model: "clef",
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
      });

      const email = createInboundEmail({
        envelopeFrom: "clef-memory@forces.gc.ca",
        envelopeTo: "agent@caf-gpt.com",
        from: "clef-memory@forces.gc.ca",
        to: ["agent@caf-gpt.com"],
        subject: "Re: Leave",
        body: "Yes, please",
        messageId: "<clef-memory@forces.gc.ca>",
      });

      await resend.deliver(instance, email);
      const clefCall = runSpy.mock.calls.find((call) => call[0] === CLEF_MODEL);
      const inputs = clefCall?.[1];

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
      const resend = installResendMock();

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
      });

      const email = createInboundEmail({
        envelopeFrom: "clef-reply@forces.gc.ca",
        envelopeTo: "agent@caf-gpt.com",
        from: "clef-reply@forces.gc.ca",
        to: ["agent@caf-gpt.com"],
        subject: "Leave question",
        body: "Can I take leave?",
        messageId: "<clef-reply@forces.gc.ca>",
      });

      await resend.deliver(instance, email);

      return {
        primeFooCalls: processWithPrimeFoo.mock.calls.length,
        structuredSends: resend.replies.length,
      };
    });

    expect(result).toEqual({ primeFooCalls: 1, structuredSends: 1 });
  });
});

/** Mocks env.AI.run to return a Clef reply/no_reply choice for the gate. */
function mockClefChoice(choice: "reply" | "no_reply", confidence: number): void {
  // SAFETY: These tests intercept only the Clef request contract missing from generated AiModels.
  const ai = env.AI as ClefAiRunner;
  vi.spyOn(ai, "run").mockImplementation(async (model: string) => {
    if (model === CLEF_MODEL) {
      return {
        model: "clef",
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

/** Gets a per-sender UserAgent Durable Object stub. */
function getUserAgentStub(senderEmail: string) {
  return env.UserAgent.get(env.UserAgent.idFromName(getUserAgentId(senderEmail)));
}
