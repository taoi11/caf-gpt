/**
 * tests/unit/ResendWebhook.test.ts
 *
 * Unit tests for Resend (Svix) webhook verification and inbox.email.received parsing
 *
 * Top-level declarations:
 * - verifyResendWebhook suite: valid, Standard Webhooks alias, missing, bad, stale, rotated
 *   signatures and a malformed secret
 * - parseResendWebhookEvent suite: received event mapping, ignored event types, deleted email,
 *   and malformed bodies
 */

import { describe, expect, it } from "vitest";
import {
  parseResendWebhookEvent,
  RESEND_WEBHOOK_TOLERANCE_SECONDS,
  verifyResendWebhook,
} from "../../src/email/resend/ResendWebhook";
import {
  buildReceivedEvent,
  createTestWebhookSecret,
  signResendWebhook,
  TEST_WEBHOOK_SECRET,
} from "../mocks/resendWebhook";

const NOW_SECONDS = 1_793_286_000;
const NOW_MS = NOW_SECONDS * 1000;

describe("verifyResendWebhook", () => {
  it("accepts a correctly signed body", async () => {
    const body = buildReceivedEvent();
    const headers = await signResendWebhook(body, NOW_SECONDS);

    await expect(verifyResendWebhook(TEST_WEBHOOK_SECRET, headers, body, NOW_MS)).resolves.toEqual({
      ok: true,
      webhookId: "msg_2Lh9KRb0pzN4LePd3XiA4cUuWsd",
    });
  });

  it("accepts the Standard Webhooks webhook-* header aliases", async () => {
    const body = buildReceivedEvent();
    const signed = await signResendWebhook(body, NOW_SECONDS);

    const headers = new Headers({
      "webhook-id": signed.get("svix-id") ?? "",
      "webhook-timestamp": signed.get("svix-timestamp") ?? "",
      "webhook-signature": signed.get("svix-signature") ?? "",
    });

    const result = await verifyResendWebhook(TEST_WEBHOOK_SECRET, headers, body, NOW_MS);
    expect(result.ok).toBe(true);
  });

  it("accepts any matching v1 entry when several signatures are sent (secret rotation)", async () => {
    const body = buildReceivedEvent();
    const headers = await signResendWebhook(body, NOW_SECONDS);
    headers.set("svix-signature", `v1,AAAA ${headers.get("svix-signature")}`);

    const result = await verifyResendWebhook(TEST_WEBHOOK_SECRET, headers, body, NOW_MS);
    expect(result.ok).toBe(true);
  });

  it.each([
    "svix-id",
    "svix-timestamp",
    "svix-signature",
  ])("rejects a request missing %s", async (name) => {
    const body = buildReceivedEvent();
    const headers = await signResendWebhook(body, NOW_SECONDS);
    headers.delete(name);

    await expect(verifyResendWebhook(TEST_WEBHOOK_SECRET, headers, body, NOW_MS)).resolves.toEqual({
      ok: false,
      reason: "webhook_missing_headers",
    });
  });

  it("rejects a tampered body", async () => {
    const body = buildReceivedEvent();
    const headers = await signResendWebhook(body, NOW_SECONDS);
    const tampered = buildReceivedEvent({ from: "attacker@example.com" });

    await expect(
      verifyResendWebhook(TEST_WEBHOOK_SECRET, headers, tampered, NOW_MS)
    ).resolves.toEqual({ ok: false, reason: "webhook_bad_signature" });
  });

  it("rejects a body signed with another secret", async () => {
    const body = buildReceivedEvent();
    const headers = await signResendWebhook(body, NOW_SECONDS, createTestWebhookSecret());

    await expect(verifyResendWebhook(TEST_WEBHOOK_SECRET, headers, body, NOW_MS)).resolves.toEqual({
      ok: false,
      reason: "webhook_bad_signature",
    });
  });

  it("rejects signatures that are not v1 or not base64", async () => {
    const body = buildReceivedEvent();
    const headers = await signResendWebhook(body, NOW_SECONDS);
    const valid = headers.get("svix-signature")?.slice(3) ?? "";
    headers.set("svix-signature", `v2,${valid} v1,***`);

    await expect(verifyResendWebhook(TEST_WEBHOOK_SECRET, headers, body, NOW_MS)).resolves.toEqual({
      ok: false,
      reason: "webhook_bad_signature",
    });
  });

  it.each([
    ["too old", NOW_SECONDS - RESEND_WEBHOOK_TOLERANCE_SECONDS - 1],
    ["in the future", NOW_SECONDS + RESEND_WEBHOOK_TOLERANCE_SECONDS + 1],
  ])("rejects a timestamp %s as stale (replay protection)", async (_label, timestamp) => {
    const body = buildReceivedEvent();
    const headers = await signResendWebhook(body, timestamp);

    await expect(verifyResendWebhook(TEST_WEBHOOK_SECRET, headers, body, NOW_MS)).resolves.toEqual({
      ok: false,
      reason: "webhook_stale",
    });
  });

  it("rejects a non-numeric timestamp", async () => {
    const body = buildReceivedEvent();
    const headers = await signResendWebhook(body, NOW_SECONDS);
    headers.set("svix-timestamp", "2026-10-29T15:00:00Z");

    await expect(verifyResendWebhook(TEST_WEBHOOK_SECRET, headers, body, NOW_MS)).resolves.toEqual({
      ok: false,
      reason: "webhook_bad_timestamp",
    });
  });

  it("reports a malformed signing secret separately", async () => {
    const body = buildReceivedEvent();
    const headers = await signResendWebhook(body, NOW_SECONDS);

    await expect(verifyResendWebhook(`whsec${"_"}***`, headers, body, NOW_MS)).resolves.toEqual({
      ok: false,
      reason: "webhook_bad_secret",
    });
  });
});

describe("parseResendWebhookEvent", () => {
  it("maps an inbox.email.received event to opaque ids and envelope addresses", () => {
    const result = parseResendWebhookEvent(
      buildReceivedEvent({ replyTo: ["Member <member@forces.gc.ca>"] })
    );

    expect(result).toEqual({
      ok: true,
      event: {
        type: "inbox.email.received",
        inboxId: "a1b2c3d4-0000-4000-8000-000000000001",
        threadId: "a1b2c3d4-0000-4000-8000-000000000002",
        emailId: "56761188-7520-42d8-8898-ff6fc54ce618",
        email: {
          direction: "inbound",
          from: "Member Name <member@forces.gc.ca>",
          to: ["agent@caf-gpt.com"],
          replyTo: ["Member <member@forces.gc.ca>"],
        },
      },
    });
  });

  it("keeps the ids when the email was deleted before delivery", () => {
    const result = parseResendWebhookEvent(buildReceivedEvent({ omitEmail: true }));

    expect(result.ok && result.event.type === "inbox.email.received" && result.event.email).toBe(
      undefined
    );
  });

  it("ignores other event types", () => {
    expect(parseResendWebhookEvent(buildReceivedEvent({ type: "email.delivered" }))).toEqual({
      ok: true,
      event: { type: "ignored" },
    });
  });

  it.each([
    ["not JSON", "not json"],
    ["missing type", JSON.stringify({ data: {} })],
    ["missing ids", JSON.stringify({ type: "inbox.email.received", data: { inbox_id: "a" } })],
    ["id with path characters", buildReceivedEvent({ emailId: "../../emails" })],
  ])("rejects a %s body as malformed", (_label, body) => {
    expect(parseResendWebhookEvent(body)).toEqual({ ok: false, reason: "webhook_malformed" });
  });
});
