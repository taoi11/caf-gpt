/**
 * tests/workers/ResendWebhookRoute.test.ts
 *
 * Workers tests for the Resend webhook route in src/index.ts: Svix verification (valid, missing,
 * bad, stale, malformed), ignored events, sender and recipient gates, dedupe of repeated
 * deliveries, fail-loud configuration and routing errors, and privacy-safe boundary logs
 *
 * Top-level declarations:
 * - LoggedLine: Structured log payload captured from console
 * - captureLogs: Spies on console methods and collects structured log payloads
 * - postWebhook: Sends a (signed by default) webhook request through worker.fetch
 */

/// <reference types="@cloudflare/vitest-pool-workers/types" />

import { reset } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import worker, { RESEND_WEBHOOK_PATH } from "../../src/index";
import { buildReceivedEvent, signResendWebhook } from "../mocks/resendWebhook";
import { installResendMock } from "./resendHarness";

const EMAIL_REF_PATTERN = /^[0-9a-f]{16}$/;

beforeEach(() => {
  // Any background processing the route schedules must never reach the real Resend API.
  installResendMock();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await reset();
});

describe("Resend webhook route", () => {
  it("accepts a signed inbound email once and reports repeated deliveries as duplicates", async () => {
    const logs = captureLogs();
    const body = buildReceivedEvent({ emailId: "route-dedupe-1" });

    const first = await postWebhook(body);
    const second = await postWebhook(body);

    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toEqual({ outcome: "accepted" });
    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toEqual({ outcome: "duplicate" });

    const routed = logs.find((line) => line.message === "Email routed");
    expect(routed).toMatchObject({
      route: "resend_webhook",
      senderDomain: "forces.gc.ca",
      receivingDomain: "caf-gpt.com",
      resendEmailId: "route-dedupe-1",
    });
    expect(routed?.emailRef).toMatch(EMAIL_REF_PATTERN);
    const serialized = JSON.stringify(logs).toLowerCase();
    expect(serialized).not.toContain("member@forces.gc.ca");
    expect(serialized).not.toContain("member name");
    expect(serialized).not.toContain("private subject");
    expect(serialized).not.toContain("private-id");
  });

  it("rejects a request without Svix headers", async () => {
    const response = await postWebhook(buildReceivedEvent(), { unsigned: true });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ outcome: "webhook_missing_headers" });
  });

  it("rejects a bad signature", async () => {
    const response = await postWebhook(buildReceivedEvent(), {
      secret: "whsec_b3RoZXItc2VjcmV0",
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ outcome: "webhook_bad_signature" });
  });

  it("rejects a stale timestamp", async () => {
    const response = await postWebhook(buildReceivedEvent(), {
      timestampSeconds: Math.floor(Date.now() / 1000) - 3600,
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ outcome: "webhook_stale" });
  });

  it("rejects a signed but malformed body", async () => {
    const response = await postWebhook('{"type":"inbox.email.received","data":{}}');

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ outcome: "webhook_malformed" });
  });

  it("rejects an oversized body before verifying it", async () => {
    const response = await postWebhook("x".repeat(300 * 1024), { unsigned: true });

    expect(response.status).toBe(413);
  });

  it.each([
    ["another event type", { type: "email.delivered" }, "event_ignored"],
    ["a deleted email", { omitEmail: true }, "email_missing"],
    ["an outbound email", { direction: "outbound" as const }, "outbound_ignored"],
    [
      "an unauthorized sender",
      { from: "Outsider <outsider.person@example.com>" },
      "sender_not_authorized",
    ],
    ["an unmonitored inbox", { to: ["other@caf-gpt.com"] }, "recipient_not_monitored"],
  ])("acknowledges %s with 200 and does nothing", async (_label, options, outcome) => {
    const logs = captureLogs();
    const response = await postWebhook(buildReceivedEvent(options));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ outcome });
    expect(logs.some((line) => line.message === "Email routed")).toBe(false);
    expect(JSON.stringify(logs)).not.toContain("outsider.person");
  });

  it("fails loudly with 500 when a Resend secret is missing", async () => {
    const logs = captureLogs();
    const brokenEnv = { ...env };
    Reflect.deleteProperty(brokenEnv, "RESEND_API_KEY");

    const response = await postWebhook(buildReceivedEvent(), {}, brokenEnv);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ outcome: "webhook_misconfigured" });
    expect(logs.find((line) => line.message === "Resend webhook rejected")).toMatchObject({
      level: "error",
      missingApiKey: true,
      missingWebhookSecret: false,
    });
  });

  it("returns 500 so Resend retries when the UserAgent cannot be reached", async () => {
    const brokenEnv = { ...env };
    Reflect.deleteProperty(brokenEnv, "UserAgent");

    const response = await postWebhook(buildReceivedEvent(), {}, brokenEnv);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ outcome: "routing_failed" });
  });

  it("answers 405 to non-POST requests on the webhook path", async () => {
    const response = await worker.fetch(
      new Request(`https://caf-gpt.com${RESEND_WEBHOOK_PATH}`),
      env
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
  });
});

/** Structured log payload captured from console. */
interface LoggedLine {
  message: string;
  [field: string]: string | number | boolean | null | undefined | string[];
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

/** Options for one webhook request. */
interface PostOptions {
  unsigned?: boolean;
  secret?: string;
  timestampSeconds?: number;
}

/** Sends a webhook request (signed with the test secret by default) through worker.fetch. */
async function postWebhook(
  body: string,
  options: PostOptions = {},
  workerEnv: Env = env
): Promise<Response> {
  const headers = options.unsigned
    ? new Headers({ "content-type": "application/json" })
    : await signResendWebhook(
        body,
        options.timestampSeconds ?? Math.floor(Date.now() / 1000),
        options.secret
      );

  return await worker.fetch(
    new Request(`https://caf-gpt.com${RESEND_WEBHOOK_PATH}`, { method: "POST", headers, body }),
    workerEnv
  );
}
