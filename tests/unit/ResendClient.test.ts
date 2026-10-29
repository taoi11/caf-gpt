/**
 * tests/unit/ResendClient.test.ts
 *
 * Unit tests for the Resend REST client, using an injected fetch (no live calls)
 *
 * Top-level declarations:
 * - RecordedCall: One request captured by the fake fetch
 * - FakeFetch: A fake fetch plus the calls it recorded
 * - createFakeFetch: Fake fetch that records calls and answers with a fixed response
 * - ResendClient suite: request paths, auth headers, reply body and Idempotency-Key, raw download
 *   rules, Message-ID lookup, and content-free errors
 */

import { describe, expect, it } from "vitest";
import { ResendClient, type ResendFetch } from "../../src/email/resend/ResendClient";
import { ResendAPIError } from "../../src/errors";

/** One request captured by the fake fetch. */
interface RecordedCall {
  url: string;
  method: string;
  headers: Headers;
  body?: string;
}

/** A fake fetch plus the calls it recorded. */
interface FakeFetch {
  fetcher: ResendFetch;
  calls: RecordedCall[];
}

/** Fake fetch that records each call and answers with the response the factory builds. */
function createFakeFetch(respond: () => Response): FakeFetch {
  const calls: RecordedCall[] = [];

  const fetcher: ResendFetch = async (url, init) => {
    calls.push({
      url,
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
      body: init?.body === undefined ? undefined : String(init.body),
    });

    return respond();
  };

  return { fetcher, calls };
}

describe("ResendClient", () => {
  it("reads the inbox address with bearer auth", async () => {
    const fake = createFakeFetch(() =>
      Response.json({ id: "inbox-1", email_address: "agent@caf-gpt.com" })
    );

    const client = new ResendClient("re_test", fake.fetcher);

    await expect(client.getInboxAddress("inbox-1")).resolves.toBe("agent@caf-gpt.com");
    expect(fake.calls[0].url).toBe("https://api.resend.com/inboxes/inbox-1");
    expect(fake.calls[0].headers.get("Authorization")).toBe("Bearer re_test");
    expect(fake.calls[0].headers.get("User-Agent")).toBe("caf-gpt-email");
  });

  it("reads authentication results and the raw download URL of a received email", async () => {
    const fake = createFakeFetch(() =>
      Response.json({
        id: "email-1",
        authentication: { spf: "pass", dkim: "gray", dmarc: "pass" },
        raw: { download_url: "https://cdn.resend.test/raw?sig=1", expires_at: "2026-10-29" },
      })
    );

    const client = new ResendClient("re_test", fake.fetcher);

    await expect(client.getReceivedEmail("email-1")).resolves.toEqual({
      authentication: { spf: "pass", dkim: "gray", dmarc: "pass" },
      rawDownloadUrl: "https://cdn.resend.test/raw?sig=1",
    });
    expect(fake.calls[0].url).toBe("https://api.resend.com/emails/receiving/email-1");
  });

  it("treats missing authentication results as null", async () => {
    const fake = createFakeFetch(() => Response.json({ id: "email-1", authentication: null }));
    const client = new ResendClient("re_test", fake.fetcher);

    await expect(client.getReceivedEmail("email-1")).resolves.toEqual({ authentication: null });
  });

  it("posts the thread reply with JSON body and the Idempotency-Key header", async () => {
    const fake = createFakeFetch(() => Response.json({ id: "sent-1" }));
    const client = new ResendClient("re_test", fake.fetcher);

    const id = await client.replyToThreadEmail(
      "inbox-1",
      "thread-1",
      "email-1",
      {
        subject: "Re: Leave",
        html: "<p>Hi</p>",
        text: "Hi",
        cc: ["ally@forces.gc.ca"],
        headers: { "Thread-Topic": "Leave" },
        reply_all: false,
      },
      "caf-gpt-reply/email-1"
    );

    expect(id).toBe("sent-1");
    expect(fake.calls[0]).toMatchObject({
      url: "https://api.resend.com/inboxes/inbox-1/threads/thread-1/emails/email-1/reply",
      method: "POST",
    });
    expect(fake.calls[0].headers.get("Idempotency-Key")).toBe("caf-gpt-reply/email-1");
    expect(fake.calls[0].headers.get("Content-Type")).toBe("application/json");
    expect(JSON.parse(fake.calls[0].body ?? "")).toEqual({
      subject: "Re: Leave",
      html: "<p>Hi</p>",
      text: "Hi",
      cc: ["ally@forces.gc.ca"],
      headers: { "Thread-Topic": "Leave" },
      reply_all: false,
    });
  });

  it("encodes ids into the path", async () => {
    const fake = createFakeFetch(() => Response.json({ id: "sent-1" }));
    const client = new ResendClient("re_test", fake.fetcher);
    await client.getSentMessageId("a/b");

    expect(fake.calls[0].url).toBe("https://api.resend.com/emails/a%2Fb");
  });

  it("returns the sent Message-ID, or undefined when Resend has none yet", async () => {
    const withId = new ResendClient(
      "re_test",
      createFakeFetch(() => Response.json({ id: "sent-1", message_id: "<abc@resend.dev>" })).fetcher
    );

    const withoutId = new ResendClient(
      "re_test",
      createFakeFetch(() => Response.json({ id: "sent-1", message_id: null })).fetcher
    );

    await expect(withId.getSentMessageId("sent-1")).resolves.toBe("<abc@resend.dev>");
    await expect(withoutId.getSentMessageId("sent-1")).resolves.toBeUndefined();
  });

  it("downloads the raw MIME without sending the API key", async () => {
    const fake = createFakeFetch(() => new Response("From: a@b.c\r\n\r\nHi"));
    const client = new ResendClient("re_test", fake.fetcher);
    const raw = await client.downloadRawEmail("https://cdn.resend.test/raw?sig=1");

    expect(new TextDecoder().decode(raw)).toContain("From: a@b.c");
    expect(fake.calls[0].headers.get("Authorization")).toBeNull();
  });

  it("refuses non-https raw URLs and empty or oversized downloads", async () => {
    const empty = new ResendClient("re_test", createFakeFetch(() => new Response("")).fetcher);

    const huge = new ResendClient(
      "re_test",
      createFakeFetch(
        () => new Response("x", { headers: { "content-length": String(41 * 1024 * 1024) } })
      ).fetcher
    );

    await expect(empty.downloadRawEmail("http://cdn.resend.test/raw")).rejects.toBeInstanceOf(
      ResendAPIError
    );
    await expect(empty.downloadRawEmail("https://cdn.resend.test/raw")).rejects.toBeInstanceOf(
      ResendAPIError
    );
    await expect(huge.downloadRawEmail("https://cdn.resend.test/raw")).rejects.toBeInstanceOf(
      ResendAPIError
    );
  });

  it("throws a content-free ResendAPIError with the operation and status", async () => {
    const failing = new ResendClient(
      "re_test",
      createFakeFetch(() =>
        Response.json({ message: "secret detail user@forces.gc.ca" }, { status: 422 })
      ).fetcher
    );

    const offline = new ResendClient("re_test", async () => {
      throw new Error("network down");
    });

    const error = await failing.getInboxAddress("inbox-1").catch((caught) => caught);
    expect(error).toBeInstanceOf(ResendAPIError);
    expect(error).toMatchObject({ operation: "get_inbox", status: 422 });
    expect(String(error.message)).not.toContain("user@forces.gc.ca");
    await expect(offline.getInboxAddress("inbox-1")).rejects.toMatchObject({
      operation: "get_inbox",
      status: 0,
    });
  });

  it("rejects a success response that does not match the documented body", async () => {
    const client = new ResendClient("re_test", createFakeFetch(() => Response.json({})).fetcher);

    await expect(
      client.replyToThreadEmail(
        "inbox-1",
        "thread-1",
        "email-1",
        { subject: "Re", text: "Hi", reply_all: false },
        "key"
      )
    ).rejects.toMatchObject({ operation: "reply", status: 200 });
  });
});
