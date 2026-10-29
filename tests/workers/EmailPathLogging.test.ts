/**
 * tests/workers/EmailPathLogging.test.ts
 *
 * Workers tests for the inbound email logging contract: receipt, skip, Clef, and terminal outcome
 * lines share one emailRef and never contain addresses, subjects, bodies, or Message-IDs; quoted
 * history is logged as flags, counts, and a fixed failure reason only
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

import { createExecutionContext, reset, runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import type { AgentEmail } from "agents/email";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentCoordinator } from "../../src/agents/AgentCoordinator";
import { CLEF_MODEL } from "../../src/agents/utils/ClefDecision";
import { getUserAgentId, type UserAgent } from "../../src/agents/UserAgent";
import { EMAIL_REF_HEADER } from "../../src/email/utils/LogRedaction";
import worker, { createUserAgentResolver } from "../../src/index";

const SENDER = "Luffy.Dhaliwal@forces.gc.ca";
const SUBJECT = "Secret subject line";
const BODY = "Private body text about my leave";
const MESSAGE_ID = "<private-message-id@forces.gc.ca>";
const DATE_HEADER = "Wed, 28 Oct 2026 17:29:00 +0000";
const WORKER_EMAIL_REF = "0123456789abcdef";
const EMAIL_REF_PATTERN = /^[0-9a-f]{16}$/;

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

    const emailRef = WORKER_EMAIL_REF;
    expect(lines.map((line) => line.message)).toEqual([
      "Inbound email received by UserAgent",
      "Clef injection screen blocked Prime Foo",
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
      reason: "clef_suspected_injection",
    });
    expect(lines[3]).toMatchObject({
      level: "info",
      outcome: "skipped",
      reason: "clef_suspected_injection",
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
      lines.find((line) => line.message === "Clef injection screen allowed Prime Foo")
    ).toMatchObject({ choice: "reply", confidence: 0.91, reason: "clef_reply" });
    expect(lines.at(-1)).toMatchObject({ outcome: "replied", reason: "reply_sent" });
    expect(JSON.stringify(lines)).not.toContain("Model output");
    expectNoSensitiveContent(lines);
  });

  it("logs topic diagnostics on the reply-accepted line as booleans only", async () => {
    const stub = getUserAgentStub(SENDER);

    const lines = await runInDurableObject(stub, async (instance: UserAgent) => {
      const logs = captureLogs();
      vi.spyOn(AgentCoordinator.prototype, "processWithPrimeFoo").mockResolvedValue({
        shouldRespond: true,
        content: "<p>Reply</p>",
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
      await instance.onEmail(createAgentEmail({ headers: { "Thread-Topic": SUBJECT } }));

      return logs;
    });

    const accepted = lines.find((line) => line.message === "Inbound email reply accepted");
    expect(accepted).toMatchObject({
      outlookThreaded: false,
      threadTopicPresent: true,
      threadTopicMatches: true,
      subjectHasTag: false,
    });
    expectNoSensitiveContent(lines);
  });

  it("logs quoted-history flags and counts on the reply-accepted line, never quote content", async () => {
    const stub = getUserAgentStub(SENDER);
    const html = `<html><body><p>${BODY}</p><script>alert(1)</script></body></html>`;

    const { lines, sent } = await runInDurableObject(stub, async (instance: UserAgent) => {
      const logs = captureLogs();
      vi.spyOn(AgentCoordinator.prototype, "processWithPrimeFoo").mockResolvedValue({
        shouldRespond: true,
        content: "<p>Reply</p>",
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

      const send = vi.spyOn(getEmailBinding(instance), "send").mockResolvedValue({
        messageId: "structured-reply",
      });

      await instance.onEmail(createAgentEmail({ from: `"Dhaliwal, Luffy" <${SENDER}>`, html }));

      return { lines: logs, sent: send.mock.calls[0][0] };
    });

    // The reply itself does quote the sender, subject, and body.
    expect(sent.html).toContain(BODY);
    expect(sent.text).toContain(`Subject: ${SUBJECT}`);
    const accepted = lines.find((line) => line.message === "Inbound email reply accepted");
    expect(accepted).toMatchObject({
      quotedHistoryIncluded: true,
      quotedHtml: true,
      quoteRemovedNodes: 1,
    });
    // postal-mime keeps the MIME part's trailing line break, so the count may exceed the fixture.
    expect(accepted?.quoteSourceBytes).toBeGreaterThanOrEqual(
      new TextEncoder().encode(html).length
    );
    expect(accepted?.quoteSourceBytes).toBeLessThanOrEqual(
      new TextEncoder().encode(html).length + 2
    );
    expectNoSensitiveContent(lines);
    expect(JSON.stringify(lines).toLowerCase()).not.toContain("dhaliwal");
  });

  it("logs a fixed quote failure reason and sends the funny error reply when the quote fails", async () => {
    const stub = getUserAgentStub(SENDER);

    const { lines, sent } = await runInDurableObject(stub, async (instance: UserAgent) => {
      const logs = captureLogs();
      vi.spyOn(AgentCoordinator.prototype, "processWithPrimeFoo").mockResolvedValue({
        shouldRespond: true,
        content: "<p>Reply that must not go out without its quote</p>",
      });
      mockClefChoice("reply", 0.91);

      const send = vi.spyOn(getEmailBinding(instance), "send").mockResolvedValue({
        messageId: "error-reply",
      });

      await instance.onEmail(createAgentEmail({ omitDate: true }));

      return { lines: logs, sent: send.mock.calls.map(([message]) => message) };
    });

    expect(lines.find((line) => line.message === "Quoted history build failed")).toMatchObject({
      level: "error",
      emailRef: WORKER_EMAIL_REF,
      quotedHistoryIncluded: false,
      quoteFailureReason: "quote_missing_date",
    });
    expect(lines.find((line) => line.message === "Email processing failed")).toMatchObject({
      errorName: "QuotedHistoryError",
      errorCode: "EMAIL_COMPOSITION_ERROR",
      sendAttempted: false,
    });
    expect(lines.at(-1)).toMatchObject({
      outcome: "error",
      reason: "quote_missing_date",
      errorReply: "sent",
    });
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toBe("Error Processing Email");
    expect(sent[0].text).toContain("face-planted");
    expect(sent[0].text).not.toContain("quote");
    expect(sent[0].text).not.toContain("Reply that must not go out");
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
        headers: new Headers({
          "message-id": MESSAGE_ID,
          subject: SUBJECT,
          [EMAIL_REF_HEADER]: WORKER_EMAIL_REF,
        }),
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
      emailRef: WORKER_EMAIL_REF,
      senderDomain: "forces.gc.ca",
      receivingDomain: "caf-gpt.com",
    });
    expectNoSensitiveContent(logs);
  });

  it("gives emails without a Message-ID or Worker ref distinct emailRefs, never none", async () => {
    const stub = getUserAgentStub(SENDER);

    const refs = await runInDurableObject(stub, async (instance: UserAgent) => {
      const logs = captureLogs();

      const options = {
        headers: { "Auto-Submitted": "auto-replied" },
        omitMessageId: true,
        omitEmailRef: true,
      };

      await instance.onEmail(createAgentEmail(options));
      await instance.onEmail(createAgentEmail(options));

      return logs
        .filter((line) => line.message === "Inbound email outcome")
        .map((line) => line.emailRef);
    });

    expect(refs).toHaveLength(2);
    expect(refs[0]).toMatch(EMAIL_REF_PATTERN);
    expect(refs[1]).toMatch(EMAIL_REF_PATTERN);
    expect(refs[0]).not.toBe(refs[1]);
  });

  it("assigns one Worker emailRef per message and overwrites a sender-supplied ref header", async () => {
    const logs = captureLogs();
    const spoofedRef = "ffffffffffffffff";
    const setReject = vi.fn();
    await worker.email(
      {
        from: "outsider.person@example.com",
        to: "agent@caf-gpt.com",
        headers: new Headers({ "message-id": MESSAGE_ID, [EMAIL_REF_HEADER]: spoofedRef }),
        raw: new ReadableStream<Uint8Array>(),
        rawSize: 0,
        setReject,
        forward: vi.fn(),
        reply: vi.fn(),
      },
      env,
      createExecutionContext()
    );

    const ignored = logs.find((line) => line.message === "Email ignored - sender not authorized");
    const rejected = logs.find((line) => line.message === "Email rejected - no UserAgent route");
    expect(ignored?.emailRef).toMatch(EMAIL_REF_PATTERN);
    expect(ignored?.emailRef).not.toBe(spoofedRef);
    expect(rejected?.emailRef).toBe(ignored?.emailRef);
    expect(setReject).toHaveBeenCalledOnce();
    expect(JSON.stringify(logs)).not.toContain("outsider.person");
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
    if (model === CLEF_MODEL) {
      return {
        model: "clef",
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

/** Builds a mock AgentEmail as routed by the Worker (with its emailRef header) from an authorized sender. */
function createAgentEmail(options: {
  envelopeFrom?: string;
  from?: string;
  headers?: Record<string, string>;
  omitMessageId?: boolean;
  omitEmailRef?: boolean;
  omitDate?: boolean;
  html?: string;
}): AgentEmail {
  const from = options.from ?? SENDER;
  const extraHeaders = Object.entries(options.headers ?? {}).map(([k, v]) => `${k}: ${v}`);

  const raw = [
    `From: ${from}`,
    "To: agent@caf-gpt.com",
    `Subject: ${SUBJECT}`,
    ...(options.omitMessageId ? [] : [`Message-ID: ${MESSAGE_ID}`]),
    ...(options.omitDate ? [] : [`Date: ${DATE_HEADER}`]),
    ...extraHeaders,
    ...(options.html
      ? [
          'Content-Type: multipart/alternative; boundary="b1"',
          "",
          "--b1",
          "Content-Type: text/plain; charset=utf-8",
          "",
          BODY,
          "--b1",
          "Content-Type: text/html; charset=utf-8",
          "",
          options.html,
          "--b1--",
        ]
      : ["Content-Type: text/plain; charset=utf-8", "", BODY]),
  ].join("\r\n");

  const headers = new Headers({ from, to: "agent@caf-gpt.com", subject: SUBJECT });

  if (!options.omitMessageId) {
    headers.set("message-id", MESSAGE_ID);
  }

  if (!options.omitEmailRef) {
    headers.set(EMAIL_REF_HEADER, WORKER_EMAIL_REF);
  }

  for (const [name, value] of Object.entries(options.headers ?? {})) {
    headers.set(name, value);
  }

  return {
    from: options.envelopeFrom ?? SENDER,
    to: "agent@caf-gpt.com",
    headers,
    rawSize: raw.length,
    getRaw: vi.fn(async () => new TextEncoder().encode(raw)),
    setReject: vi.fn(),
    forward: vi.fn(),
    reply: vi.fn(async () => ({ messageId: "mock-reply" })),
  };
}
