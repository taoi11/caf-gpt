/**
 * tests/workers/EmailPathLogging.test.ts
 *
 * Workers tests for the inbound email logging contract: receipt, skip, Clef, and terminal outcome
 * lines share one emailRef and never contain addresses, subjects, bodies, or Message-IDs
 *
 * Top-level declarations:
 * - LoggedLine: Structured log payload captured from console
 * - LogFieldValue: Field values emitted by Logger payloads
 * - AiRunStub / getAiRunStub: Minimal AI binding surface for spying
 * - captureLogs: Spies on console methods and collects structured log payloads
 * - expectNoSensitiveContent: Asserts serialized logs omit addresses, subject, body, and Message-ID
 * - mockClefChoice: Mocks env.AI.run to return a Clef reply/no_reply choice
 * - getUserAgentStub: Gets a per-sender UserAgent Durable Object stub
 * - getEmailBinding: Gets the UserAgent's structured Email Service binding
 * - createAgentEmail: Builds a mock AgentEmail
 */

/// <reference types="@cloudflare/vitest-pool-workers/types" />

import { reset, runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import type { AgentEmail } from "agents/email";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentCoordinator } from "../../src/agents/AgentCoordinator";
import { CLEF_FLASH_MODEL } from "../../src/agents/utils/ClefDecision";
import { getUserAgentId, type UserAgent } from "../../src/agents/UserAgent";
import { createEmailRef } from "../../src/email/utils/LogRedaction";
import { createUserAgentResolver } from "../../src/index";

const SENDER = "Luffy.Dhaliwal@forces.gc.ca";
const SUBJECT = "Secret subject line";
const BODY = "Private body text about my leave";
const MESSAGE_ID = "<private-message-id@forces.gc.ca>";

afterEach(async () => {
  vi.restoreAllMocks();
  await reset();
});

describe("inbound email logging contract", () => {
  it("logs receipt, Clef decision with choice/confidence, and a skipped outcome", async () => {
    const stub = getUserAgentStub(SENDER);
    const lines = await runInDurableObject(stub, async (instance: UserAgent) => {
      const logs = captureLogs();
      vi.spyOn(AgentCoordinator.prototype, "processWithPrimeFoo").mockResolvedValue({
        shouldRespond: true,
        content: "<p>should not send</p>",
      });
      mockClefChoice("no_reply", 0.93);
      await instance.onEmail(createAgentEmail({}));
      return logs;
    });

    const emailRef = await createEmailRef(MESSAGE_ID);
    expect(lines.map((line) => line.message)).toEqual([
      "Inbound email received by UserAgent",
      "Clef no_reply gate skipped Prime Foo",
      "Inbound email completed without a reply",
      "Inbound email outcome",
    ]);
    expect(lines.every((line) => line.emailRef === emailRef)).toBe(true);
    expect(lines[0]).toMatchObject({
      senderDomain: "forces.gc.ca",
      receivingDomain: "caf-gpt.com",
    });
    expect(lines[1]).toMatchObject({
      choice: "no_reply",
      confidence: 0.93,
      reason: "clef_no_reply",
    });
    expect(lines[3]).toMatchObject({
      level: "info",
      outcome: "skipped",
      reason: "clef_no_reply",
    });
    expect(lines[3].durationMs).toEqual(expect.any(Number));
    expectNoSensitiveContent(lines);
  });

  it("logs the auto-reply category and header names without header values", async () => {
    const stub = getUserAgentStub(SENDER);
    const lines = await runInDurableObject(stub, async (instance: UserAgent) => {
      const logs = captureLogs();
      await instance.onEmail(
        createAgentEmail({ headers: { "Auto-Submitted": "auto-replied secret-value" } })
      );
      return logs;
    });

    const autoReply = lines.find((line) => line.message === "Ignoring auto-reply or bounce email");
    expect(autoReply).toMatchObject({
      categories: ["auto_submitted", "auto_reply_header"],
      matchedHeaders: ["auto-submitted"],
    });
    expect(lines.at(-1)).toMatchObject({ outcome: "skipped", reason: "auto_reply" });
    expect(JSON.stringify(lines)).not.toContain("secret-value");
    expectNoSensitiveContent(lines);
  });

  it("logs the self-loop skip reason", async () => {
    const stub = getUserAgentStub("agent@caf-gpt.com");
    const lines = await runInDurableObject(stub, async (instance: UserAgent) => {
      const logs = captureLogs();
      await instance.onEmail(
        createAgentEmail({ envelopeFrom: "agent@caf-gpt.com", from: "agent@caf-gpt.com" })
      );
      return logs;
    });

    expect(lines.map((line) => line.message)).toContain("Inbound email skipped by self-loop guard");
    expect(lines.at(-1)).toMatchObject({ outcome: "skipped", reason: "self_sender" });
  });

  it("logs Clef allow and a replied outcome", async () => {
    const stub = getUserAgentStub(SENDER);
    const lines = await runInDurableObject(stub, async (instance: UserAgent) => {
      const logs = captureLogs();
      vi.spyOn(AgentCoordinator.prototype, "processWithPrimeFoo").mockResolvedValue({
        shouldRespond: true,
        content: "<p>Model output that must not be logged</p>",
      });
      mockClefChoice("reply", 0.91);
      // SAFETY: schedule is mocked; UserAgent ignores the returned Schedule object.
      vi.spyOn(instance, "schedule").mockResolvedValue({
        id: "schedule-1",
        callback: "runMemoryUpdate",
        payload: "",
        type: "delayed",
        time: 1,
        delayInSeconds: 1,
      } as never);
      vi.spyOn(getEmailBinding(instance), "send").mockResolvedValue({
        messageId: "structured-reply",
      });
      await instance.onEmail(createAgentEmail({}));
      return logs;
    });

    expect(
      lines.find((line) => line.message === "Clef reply gate allowed Prime Foo")
    ).toMatchObject({ choice: "reply", confidence: 0.91, reason: "clef_reply" });
    expect(lines.at(-1)).toMatchObject({ outcome: "replied", reason: "reply_sent" });
    expect(JSON.stringify(lines)).not.toContain("Model output");
    expectNoSensitiveContent(lines);
  });

  it("logs an error outcome with the error-reply status and no exception text", async () => {
    const stub = getUserAgentStub(SENDER);
    const lines = await runInDurableObject(stub, async (instance: UserAgent) => {
      const logs = captureLogs();
      vi.spyOn(getAiRunStub(), "run").mockRejectedValue(
        new Error(`AI failed for ${SENDER}: ${BODY}`)
      );
      vi.spyOn(getEmailBinding(instance), "send").mockResolvedValue({
        messageId: "error-reply",
      });
      await instance.onEmail(createAgentEmail({}));
      return logs;
    });

    expect(lines.find((line) => line.message === "Email processing failed")).toMatchObject({
      level: "error",
      errorName: "Error",
      sendAttempted: false,
    });
    expect(lines.at(-1)).toMatchObject({
      level: "error",
      outcome: "error",
      reason: "processing_failed",
      errorReply: "sent",
    });
    expect(JSON.stringify(lines)).not.toContain("AI failed");
    expectNoSensitiveContent(lines);
  });

  it("tags the Worker boundary Email routed line with the same emailRef and no address", async () => {
    const logs = captureLogs();
    const resolver = createUserAgentResolver(env);
    await resolver(
      {
        from: SENDER,
        to: "agent@caf-gpt.com",
        headers: new Headers({ "message-id": MESSAGE_ID, subject: SUBJECT }),
        raw: new ReadableStream<Uint8Array>(),
        rawSize: 0,
        setReject: vi.fn(),
        forward: vi.fn(),
        reply: vi.fn(),
      },
      env
    );

    const routed = logs.find((line) => line.message === "Email routed");
    expect(routed).toMatchObject({
      emailRef: await createEmailRef(MESSAGE_ID),
      senderDomain: "forces.gc.ca",
      receivingDomain: "caf-gpt.com",
    });
    expectNoSensitiveContent(logs);
  });

  it("logs unauthorized senders by domain only", async () => {
    const logs = captureLogs();
    const resolver = createUserAgentResolver(env);
    await resolver(
      {
        from: "outsider.person@example.com",
        to: "agent@caf-gpt.com",
        headers: new Headers({ "message-id": MESSAGE_ID }),
        raw: new ReadableStream<Uint8Array>(),
        rawSize: 0,
        setReject: vi.fn(),
        forward: vi.fn(),
        reply: vi.fn(),
      },
      env
    );

    expect(logs[0]).toMatchObject({
      message: "Email ignored - sender not authorized",
      senderDomain: "example.com",
    });
    expect(JSON.stringify(logs)).not.toContain("outsider.person");
  });
});

/** Structured log payload captured from console. */
interface LoggedLine {
  message: string;
  [field: string]: LogFieldValue;
}

/** Field values emitted by Logger payloads. */
type LogFieldValue = string | number | boolean | null | undefined | string[];

/** Inputs passed to the AI binding by the Clef gate. */
interface AiRunInputs {
  text?: string;
  state?: string;
}

/** Minimal AI binding surface spied on by these tests. */
interface AiRunStub {
  run(model: string, inputs: AiRunInputs): Promise<object>;
}

/** Gets env.AI through the minimal run surface used by the Clef gate. */
function getAiRunStub(): AiRunStub {
  // SAFETY: env.AI exposes run(model, inputs); tests only spy on that single method.
  return env.AI as AiRunStub;
}

/** Spies on console methods and collects structured log payloads in call order. */
function captureLogs(): LoggedLine[] {
  const lines: LoggedLine[] = [];
  for (const method of ["log", "warn", "error", "debug"] as const) {
    vi.spyOn(console, method).mockImplementation((payload: LoggedLine) => {
      lines.push(payload);
    });
  }
  return lines;
}

/** Asserts serialized logs omit the sender address, subject, body, and Message-ID. */
function expectNoSensitiveContent(lines: LoggedLine[]): void {
  const serialized = JSON.stringify(lines).toLowerCase();
  expect(serialized).not.toContain(SENDER.toLowerCase());
  expect(serialized).not.toContain("luffy");
  expect(serialized).not.toContain(SUBJECT.toLowerCase());
  expect(serialized).not.toContain(BODY.toLowerCase());
  expect(serialized).not.toContain("private-message-id");
  expect(serialized).not.toContain("agent@caf-gpt.com");
}

/** Mocks env.AI.run to return a Clef reply/no_reply choice for the gate. */
function mockClefChoice(choice: "reply" | "no_reply", confidence: number): void {
  vi.spyOn(getAiRunStub(), "run").mockImplementation(async (model: string) => {
    if (model === CLEF_FLASH_MODEL) {
      return {
        model: "clef-flash",
        answers: {
          should_reply: {
            type: "choice",
            choice,
            confidence,
            probabilities: { reply: 0.5, no_reply: 0.5 },
          },
        },
      };
    }
    throw new Error("Unexpected AI.run model");
  });
}

/** Gets a per-sender UserAgent Durable Object stub. */
function getUserAgentStub(senderEmail: string) {
  return env.UserAgent.get(env.UserAgent.idFromName(getUserAgentId(senderEmail)));
}

/** Gets the structured Email Service binding held by a UserAgent instance. */
function getEmailBinding(instance: UserAgent): Env["EMAIL"] {
  // SAFETY: UserAgent extends Agent, which stores the Worker env on the protected env field.
  const runtimeAccess = instance as UserAgent & { env: Env };
  return runtimeAccess.env.EMAIL;
}

/** Builds a mock AgentEmail; defaults to an authorized forces.gc.ca sender writing to agent@. */
function createAgentEmail(options: {
  envelopeFrom?: string;
  from?: string;
  headers?: Record<string, string>;
}): AgentEmail {
  const from = options.from ?? SENDER;
  const extraHeaders = Object.entries(options.headers ?? {}).map(([k, v]) => `${k}: ${v}`);
  const raw = [
    `From: ${from}`,
    "To: agent@caf-gpt.com",
    `Subject: ${SUBJECT}`,
    `Message-ID: ${MESSAGE_ID}`,
    ...extraHeaders,
    "Content-Type: text/plain; charset=utf-8",
    "",
    BODY,
  ].join("\r\n");

  return {
    from: options.envelopeFrom ?? SENDER,
    to: "agent@caf-gpt.com",
    headers: new Headers({
      from,
      to: "agent@caf-gpt.com",
      subject: SUBJECT,
      "message-id": MESSAGE_ID,
      ...options.headers,
    }),
    rawSize: raw.length,
    getRaw: vi.fn(async () => new TextEncoder().encode(raw)),
    setReject: vi.fn(),
    forward: vi.fn(),
    reply: vi.fn(async () => ({ messageId: "mock-reply" })),
  };
}
