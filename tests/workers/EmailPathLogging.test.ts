/**
 * tests/workers/EmailPathLogging.test.ts
 *
 * Workers tests for the inbound email logging contract: receipt, skip, Clef, and terminal outcome
 * lines share one emailRef and never contain addresses, subjects, bodies, or Message-IDs; quoted
 * history is logged as flags, counts, and a fixed failure reason only; the learned Sent: zone as
 * source, offsetMinutes, a found flag, and a fixed reason only
 *
 * Top-level declarations:
 * - LoggedLine: Structured log payload captured from console
 * - LogFieldValue: Field values emitted by Logger payloads
 * - AiRunStub / getAiRunStub: Minimal AI binding surface for spying
 * - captureLogs: Spies on console methods and collects structured log payloads
 * - expectNoSensitiveContent: Asserts serialized logs omit addresses, subject, body, and Message-ID
 * - mockClefChoice: Mocks env.AI.run to return a Clef reply/no_reply choice
 * - getUserAgentStub: Gets a per-sender UserAgent Durable Object stub
 * - deliverEmail: Delivers a fixture email (raw MIME behind a mocked Resend API) to a UserAgent
 *
 * Webhook-boundary log lines ("Email routed", unauthorized senders) are covered in
 * ResendWebhookRoute.test.ts.
 */

/// <reference types="@cloudflare/vitest-pool-workers/types" />

import { reset, runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentCoordinator } from "../../src/agents/AgentCoordinator";
import { CLEF_MODEL } from "../../src/agents/utils/ClefDecision";
import { getUserAgentId, type UserAgent } from "../../src/agents/UserAgent";
import { createInboundEmail, installResendMock, type ResendMock } from "./resendHarness";

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
      await deliverEmail(instance, {});

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
      resendEmailId: expect.stringMatching(/^email-\d+$/),
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
      await deliverEmail(instance, { headers: { "Auto-Submitted": "auto-replied secret-value" } });

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
      await deliverEmail(instance, {
        envelopeFrom: "agent@caf-gpt.com",
        from: "agent@caf-gpt.com",
      });

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
      await deliverEmail(instance, {});

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
      await deliverEmail(instance, { headers: { "Thread-Topic": SUBJECT } });

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
      const resend = installResendMock();

      await deliverEmail(instance, { from: `"Dhaliwal, Luffy" <${SENDER}>`, html }, resend);

      return { lines: logs, sent: resend.replies[0].body };
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
      const resend = installResendMock();

      await deliverEmail(instance, { omitDate: true }, resend);

      return { lines: logs, sent: resend.replies.map((reply) => reply.body) };
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

  it.each([
    ["Wednesday, October 28, 2026 2:30 PM", "quoted_sent_no_record"],
    ["sometime on Wednesday", "quoted_sent_unparseable"],
  ])("logs a fixed Sent zone reason for %j at error level and still replies", async (sentValue, reason) => {
    const stub = getUserAgentStub(SENDER);

    const body = [
      "Thanks",
      "",
      "From: CAF-GPT <agent@caf-gpt.com>",
      `Sent: ${sentValue}`,
      `To: Luffy <${SENDER}>`,
      `Subject: Re: ${SUBJECT}`,
    ].join("\n");

    const { lines, sent } = await runInDurableObject(stub, async (instance: UserAgent) => {
      const logs = captureLogs();
      vi.spyOn(AgentCoordinator.prototype, "processWithPrimeFoo").mockResolvedValue({
        shouldRespond: true,
        content: "<p>Reply</p>",
      });
      mockClefChoice("reply", 0.91);
      // SAFETY: schedule is mocked; UserAgent ignores the returned Schedule object.
      vi.spyOn(instance, "schedule").mockResolvedValue({ id: "schedule-1" } as never);
      const resend = installResendMock();

      await deliverEmail(
        instance,
        { body, headers: { "in-reply-to": "<unknown-reply@caf-gpt.com>" } },
        resend
      );

      return { lines: logs, sent: resend.replies.map((reply) => reply.body) };
    });

    expect(lines.find((line) => line.message === "Quoted Sent time zone not learned")).toEqual({
      level: "error",
      message: "Quoted Sent time zone not learned",
      emailRef: WORKER_EMAIL_REF,
      senderDomain: "forces.gc.ca",
      quoteSentZoneSource: "default",
      quoteSentLineFound: true,
      quoteSentReason: reason,
    });
    expect(lines.find((line) => line.message === "Inbound email reply accepted")).toMatchObject({
      quoteSentZoneSource: "default",
      quoteSentLineFound: true,
      quoteSentReason: reason,
      sentTimeRecorded: true,
    });
    expect(lines.at(-1)).toMatchObject({ outcome: "replied", reason: "reply_sent" });
    expect(sent).toHaveLength(1);
    expect(sent[0].text).toContain("Sent: October 28, 2026 11:29 AM");
    expectNoSensitiveContent(lines);
    const serialized = JSON.stringify(lines).toLowerCase();

    for (const forbidden of ["2:30", "october", "sometime", "unknown-reply", "structured-reply"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("logs only the learned source and offset when the user's quote matches our reply", async () => {
    const stub = getUserAgentStub(SENDER);

    const body = [
      "Merci",
      "",
      "De : CAF-GPT <agent@caf-gpt.com>",
      "Envoyé : mercredi 28 octobre 2026 14:30",
      `À : Luffy <${SENDER}>`,
      `Objet : RE: ${SUBJECT}`,
    ].join("\n");

    const lines = await runInDurableObject(stub, async (instance: UserAgent) => {
      const { recordReplySentTime } = await import("../../src/agents/utils/SentTimeZone");
      recordReplySentTime(
        instance.sql.bind(instance),
        "<earlier-reply@caf-gpt.com>",
        Date.parse("2026-10-28T17:30:30Z"),
        Date.now()
      );
      const logs = captureLogs();
      vi.spyOn(AgentCoordinator.prototype, "processWithPrimeFoo").mockResolvedValue({
        shouldRespond: true,
        content: "<p>Reply</p>",
      });
      mockClefChoice("reply", 0.91);
      // SAFETY: schedule is mocked; UserAgent ignores the returned Schedule object.
      vi.spyOn(instance, "schedule").mockResolvedValue({ id: "schedule-1" } as never);
      await deliverEmail(instance, {
        body,
        headers: { "in-reply-to": "<earlier-reply@caf-gpt.com>" },
      });

      return logs;
    });

    expect(lines.some((line) => line.message === "Quoted Sent time zone not learned")).toBe(false);
    const accepted = lines.find((line) => line.message === "Inbound email reply accepted");
    expect(accepted).toMatchObject({
      quoteSentZoneSource: "learned",
      quoteSentOffsetMinutes: -180,
      quoteSentLineFound: true,
    });
    expect(accepted).not.toHaveProperty("quoteSentReason");
    expectNoSensitiveContent(lines);
    expect(JSON.stringify(lines).toLowerCase()).not.toContain("earlier-reply");
  });

  it("logs an error outcome with the error-reply status and no exception text", async () => {
    const stub = getUserAgentStub(SENDER);

    const lines = await runInDurableObject(stub, async (instance: UserAgent) => {
      const logs = captureLogs();
      vi.spyOn(getAiRunStub(), "run").mockRejectedValue(
        new Error(`AI failed for ${SENDER}: ${BODY}`)
      );
      await deliverEmail(instance, {});

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

  it("gives emails without a Message-ID or Worker ref distinct emailRefs, never none", async () => {
    const stub = getUserAgentStub(SENDER);

    const refs = await runInDurableObject(stub, async (instance: UserAgent) => {
      const logs = captureLogs();

      const options = {
        headers: { "Auto-Submitted": "auto-replied" },
        omitMessageId: true,
        omitEmailRef: true,
      };

      await deliverEmail(instance, options);
      await deliverEmail(instance, options);

      return logs
        .filter((line) => line.message === "Inbound email outcome")
        .map((line) => line.emailRef);
    });

    expect(refs).toHaveLength(2);
    expect(refs[0]).toMatch(EMAIL_REF_PATTERN);
    expect(refs[1]).toMatch(EMAIL_REF_PATTERN);
    expect(refs[0]).not.toBe(refs[1]);
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

/** Fixture overrides for one inbound email from the authorized test sender. */
interface DeliveryOptions {
  envelopeFrom?: string;
  from?: string;
  headers?: Record<string, string>;
  omitMessageId?: boolean;
  omitEmailRef?: boolean;
  omitDate?: boolean;
  html?: string;
  body?: string;
}

/**
 * Delivers a fixture email as the Worker would route it (with its emailRef) through a mocked
 * Resend API, creating the fetch mock unless the test passes one to inspect replies.
 */
async function deliverEmail(
  instance: UserAgent,
  options: DeliveryOptions,
  resend: ResendMock = installResendMock()
): Promise<void> {
  const email = createInboundEmail({
    envelopeFrom: options.envelopeFrom ?? SENDER,
    envelopeTo: "agent@caf-gpt.com",
    from: options.from ?? SENDER,
    to: ["agent@caf-gpt.com"],
    subject: SUBJECT,
    body: options.body ?? BODY,
    html: options.html,
    date: options.omitDate ? null : DATE_HEADER,
    messageId: options.omitMessageId ? undefined : MESSAGE_ID,
    headers: options.headers,
  });

  email.task.emailRef = options.omitEmailRef ? "" : WORKER_EMAIL_REF;
  await resend.deliver(instance, email);
}
