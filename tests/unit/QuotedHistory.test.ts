/**
 * tests/unit/QuotedHistory.test.ts
 *
 * Unit tests for the Outlook-style quoted history builder, Edmonton Sent: formatting, mailbox
 * formatting, and the inbound HTML sanitizer
 *
 * Top-level declarations:
 * - formatOutlookSentDate suite: Edmonton time, no weekday, final DST start, permanent UTC-6, learned offsets
 * - formatOutlookMailbox suite: Name <address>, bare address, groups
 * - sanitizeQuotedHtml suite: Active content, document wrappers, attributes, URLs, CSS allowlist
 * - buildQuotedHistory suite: HTML/text layout, Cc only when present, escaping, fail-loud reasons
 * - createSource: Builds a QuoteSource fixture
 */

import { describe, expect, it } from "vitest";
import {
  buildQuotedHistory,
  formatOutlookMailbox,
  formatOutlookSentDate,
  OUTLOOK_TEXT_RULE,
  type QuoteSource,
  sanitizeQuotedHtml,
} from "../../src/email/components/QuotedHistory";

describe("formatOutlookSentDate", () => {
  it.each([
    ["2026-10-28T17:29:00Z", "October 28, 2026 11:29 AM"],
    ["2026-10-28T06:05:00Z", "October 28, 2026 12:05 AM"],
    ["2026-10-28T18:00:00Z", "October 28, 2026 12:00 PM"],
    ["2026-10-21T19:10:00Z", "October 21, 2026 1:10 PM"],
    // DST starts 2026-03-08 02:00 MST -> 03:00 MDT.
    ["2026-03-08T08:59:00Z", "March 8, 2026 1:59 AM"],
    ["2026-03-08T09:00:00Z", "March 8, 2026 3:00 AM"],
    // Alberta stays on UTC-6: no November 2026 fall-back, including through winter.
    ["2026-11-01T07:30:00Z", "November 1, 2026 1:30 AM"],
    ["2026-11-01T08:30:00Z", "November 1, 2026 2:30 AM"],
    ["2026-11-01T09:00:00Z", "November 1, 2026 3:00 AM"],
    ["2027-01-01T06:59:00Z", "January 1, 2027 12:59 AM"],
  ])("formats %s as %s in America/Edmonton without a weekday", (iso, expected) => {
    expect(formatOutlookSentDate(new Date(iso))).toBe(expected);
  });
});

describe("formatOutlookSentDate with a learned offset", () => {
  it.each([
    [-180, "2026-10-28T17:45:00Z", "October 28, 2026 2:45 PM"],
    [-360, "2026-10-28T17:29:00Z", "October 28, 2026 11:29 AM"],
    [-150, "2026-10-28T17:29:00Z", "October 28, 2026 2:59 PM"],
    [330, "2026-10-28T20:00:00Z", "October 29, 2026 1:30 AM"],
    [0, "2026-10-28T00:00:00Z", "October 28, 2026 12:00 AM"],
  ])("offset %i formats %s as %s", (offsetMinutes, iso, expected) => {
    expect(formatOutlookSentDate(new Date(iso), { offsetMinutes })).toBe(expected);
  });

  it("writes the Sent: line of a built quote in the learned offset", () => {
    const result = buildQuotedHistory(createSource({}), { offsetMinutes: -180 });
    expect(result.ok && result.quote.text).toContain("Sent: October 28, 2026 2:29 PM");
    expect(result.ok && result.quote.html).toContain("<b>Sent:</b> October 28, 2026 2:29 PM<br>");
  });
});

describe("formatOutlookMailbox", () => {
  it("formats names, bare addresses, and groups as Outlook shows them", () => {
    expect(
      formatOutlookMailbox([
        { name: "Dhaliwal, MCpl Luffy", address: "Luffy.Dhaliwal@forces.gc.ca" },
        { name: "", address: "bare@forces.gc.ca" },
        { name: "same@forces.gc.ca", address: "same@forces.gc.ca" },
        { name: "Team", group: [{ name: "Ally", address: "ally@forces.gc.ca" }] },
        { name: "Line\r\nBreak", address: "folded@forces.gc.ca" },
      ])
    ).toEqual([
      "Dhaliwal, MCpl Luffy <Luffy.Dhaliwal@forces.gc.ca>",
      "bare@forces.gc.ca",
      "same@forces.gc.ca",
      "Ally <ally@forces.gc.ca>",
      "Line Break <folded@forces.gc.ca>",
    ]);
    expect(formatOutlookMailbox(undefined)).toEqual([]);
  });
});

describe("sanitizeQuotedHtml", () => {
  it("removes scripts, active content, and the inbound document wrappers", () => {
    const { html, removedNodes } = sanitizeQuotedHtml(
      [
        "<!DOCTYPE html><html><head><title>t</title><style>body{x}</style>",
        "<meta charset=utf-8><base href='https://evil.example'></head>",
        "<body onload='alert(1)'><!-- comment --><p>Keep me</p>",
        "<script>alert(1)</script><iframe src='https://evil.example'></iframe>",
        "<object data='x'></object><embed src='x'><form><input value='x'></form>",
        "<svg><script>alert(2)</script></svg><noscript>n</noscript></body></html>",
      ].join("")
    );

    expect(html).toBe("<p>Keep me</p>");
    expect(removedNodes).toBeGreaterThanOrEqual(10);
  });

  it("drops event handlers, unsafe URLs, and unsafe styles but keeps formatting", () => {
    const { html } = sanitizeQuotedHtml(
      [
        "<p class=MsoNormal style='margin:0cm' onclick='x()'>A<o:p></o:p></p>",
        "<a href='javascript:alert(1)'>bad</a>",
        "<a href=' JaVaScRiPt:alert(1)'>bad2</a>",
        "<a href='https://example.com/x?a=1&amp;b=2'>good</a>",
        "<a href='mailto:a@b.c'>mail</a>",
        "<span style='width:expression(alert(1))'>e</span>",
        "<span style='background:url(https://track.example/p.gif)'>u</span>",
        "<span style='color:\\65 xpression'>esc</span>",
        "<img src='cid:image001.png'>",
        "<img src='https://example.com/i.png' alt='i' onerror='x()'>",
        "<img src='data:image/svg+xml;base64,AAAA'>",
        "<table border=0 cellpadding=0><tr><td valign=top>cell</td></tr></table>",
        "<b>bold</b> &lt;not a tag&gt;",
      ].join("")
    );

    expect(html).toBe(
      [
        '<p class="MsoNormal" style="margin:0cm">A</p>',
        "<a>bad</a>",
        "<a>bad2</a>",
        '<a href="https://example.com/x?a=1&amp;b=2">good</a>',
        '<a href="mailto:a@b.c">mail</a>',
        "<span>e</span>",
        "<span>u</span>",
        "<span>esc</span>",
        '<img src="https://example.com/i.png" alt="i">',
        '<table border="0" cellpadding="0"><tr><td valign="top">cell</td></tr></table>',
        "<b>bold</b> &lt;not a tag&gt;",
      ].join("")
    );
  });

  it("keeps only allowlisted CSS declarations with inert values", () => {
    const { html, removedNodes } = sanitizeQuotedHtml(
      [
        `<span style='background-image: image-set("https://track.example/p.gif" 1x)'>a</span>`,
        `<span style="background: image-set('https://track.example/p.gif' 1x)">b</span>`,
        "<span style='color:rgb(1, 2, 3); position:fixed; font-family:\"Aptos\",sans-serif'>c</span>",
        "<span style='mso-ligatures:standardcontextual;color:/**/red;behavior:url(x.htc)'>d</span>",
        "<span style='border:none;border-top:solid #E1E1E1 1.0pt;padding:3.0pt 0cm 0cm 0cm'>e</span>",
        "<span style='font-size:11.0pt;color:var(--x);width:calc(1px + 2px)'>f</span>",
      ].join("")
    );

    expect(html).toBe(
      [
        "<span>a</span>",
        "<span>b</span>",
        '<span style="color:rgb(1, 2, 3);font-family:&quot;Aptos&quot;,sans-serif">c</span>',
        '<span style="mso-ligatures:standardcontextual">d</span>',
        '<span style="border:none;border-top:solid #E1E1E1 1.0pt;padding:3.0pt 0cm 0cm 0cm">e</span>',
        '<span style="font-size:11.0pt">f</span>',
      ].join("")
    );
    expect(html).not.toContain("track.example");
    expect(removedNodes).toBe(7);
  });

  it("drops string-sourced resource loads on allowlisted properties", () => {
    const { html, removedNodes } = sanitizeQuotedHtml(
      [
        `<span style='font-family:-webkit-image-set("https://track.example/a.gif" 1x)'>a</span>`,
        `<span style='mso-bg:IMAGE-SET("https://track.example/b.gif" 1x)'>b</span>`,
        `<span style='border-top:cross-fade("https://track.example/c.gif", rgb(0,0,0) 50%)'>c</span>`,
        "<span style='mso-x:element(#track)'>d</span>",
        `<span style='font-family:src("https://track.example/e.gif")'>e</span>`,
        `<span style='color:rgb(1,2,3) image ("https://track.example/f.gif")'>f</span>`,
        `<span style='@import "https://track.example/g.css";color:red'>g</span>`,
      ].join("")
    );

    expect(html).toBe(
      [
        "<span>a</span>",
        "<span>b</span>",
        "<span>c</span>",
        "<span>d</span>",
        "<span>e</span>",
        "<span>f</span>",
        '<span style="color:red">g</span>',
      ].join("")
    );
    expect(html).not.toContain("track");
    expect(removedNodes).toBe(7);
  });

  it("scans long CSS values in linear time", () => {
    const longValue = "a".repeat(1_000_000);
    const started = performance.now();

    const { html } = sanitizeQuotedHtml(
      `<span style='font-family:${longValue}'>x</span><span style='color:${longValue}url(y)'>z</span>`
    );

    expect(performance.now() - started).toBeLessThan(1000);
    expect(html).toBe(`<span style="font-family:${longValue}">x</span><span>z</span>`);
  });

  it("cannot be broken out of with stray closing tags", () => {
    const { html } = sanitizeQuotedHtml("<p>x</p></div></body></html><div>y");
    expect(html).toBe("<p>x</p><div>y</div>");
  });
});

describe("buildQuotedHistory", () => {
  it("builds the Outlook HTML and text layout with Cc when present", () => {
    const result = buildQuotedHistory(
      createSource({ html: "<html><body><p class=MsoNormal>Hello</p></body></html>" })
    );

    if (!result.ok) throw new Error(result.reason);

    expect(result.quote.html).toBe(
      [
        "<p class=MsoNormal>&nbsp;</p>",
        "<div style='border:none;border-top:solid #E1E1E1 1.0pt;padding:3.0pt 0cm 0cm 0cm'>",
        "<p class=MsoNormal><b>From:</b> Dhaliwal, MCpl Luffy &lt;luffy@forces.gc.ca&gt;<br>",
        "<b>Sent:</b> October 28, 2026 11:29 AM<br>",
        "<b>To:</b> CAF-GPT &lt;agent@caf-gpt.com&gt;; second@forces.gc.ca<br>",
        "<b>Cc:</b> Ally &lt;ally@forces.gc.ca&gt;<br>",
        "<b>Subject:</b> RE: feedback note please</p>",
        "</div>",
        "<p class=MsoNormal>&nbsp;</p>",
        "<div>",
        '<p class="MsoNormal">Hello</p>',
        "</div>",
      ].join("\n")
    );
    expect(result.quote.text).toBe(
      [
        OUTLOOK_TEXT_RULE,
        "From: Dhaliwal, MCpl Luffy <luffy@forces.gc.ca>",
        "Sent: October 28, 2026 11:29 AM",
        "To: CAF-GPT <agent@caf-gpt.com>; second@forces.gc.ca",
        "Cc: Ally <ally@forces.gc.ca>",
        "Subject: RE: feedback note please",
        "",
        "Hello",
      ].join("\n")
    );
    expect(OUTLOOK_TEXT_RULE).toBe("_".repeat(32));
    expect(result.quote.quotedHtml).toBe(true);
    expect(result.quote.sourceBytes).toBe(
      "<html><body><p class=MsoNormal>Hello</p></body></html>".length
    );
  });

  it("omits the Cc line when there is no Cc", () => {
    const result = buildQuotedHistory(createSource({ cc: [] }));

    if (!result.ok) throw new Error(result.reason);

    expect(result.quote.html).not.toContain("Cc:");
    expect(result.quote.text).not.toContain("Cc:");
    expect(result.quote.text).toContain(
      "To: CAF-GPT <agent@caf-gpt.com>; second@forces.gc.ca\nSubject:"
    );
  });

  it("escapes the text body and header values when there is no HTML part", () => {
    const result = buildQuotedHistory(
      createSource({
        subject: "<b>x</b> & y",
        body: "Line <script>alert(1)</script>\n\nSecond & last",
      })
    );

    if (!result.ok) throw new Error(result.reason);

    expect(result.quote.quotedHtml).toBe(false);
    expect(result.quote.html).toContain("<b>Subject:</b> &lt;b&gt;x&lt;/b&gt; &amp; y</p>");
    expect(result.quote.html).toContain(
      "<div>\n<p class=MsoNormal>Line &lt;script&gt;alert(1)&lt;/script&gt;</p>\n<p class=MsoNormal>&nbsp;</p>\n<p class=MsoNormal>Second &amp; last</p>\n</div>"
    );
    expect(result.quote.html).not.toContain("<script");
    expect(result.quote.sourceBytes).toBe(
      new TextEncoder().encode("Line <script>alert(1)</script>\n\nSecond & last").byteLength
    );
  });

  it("carries a nested chain forward unchanged below the new header block", () => {
    const nested = buildQuotedHistory(createSource({ body: "LEVEL-1" }));

    if (!nested.ok) throw new Error(nested.reason);

    const outer = buildQuotedHistory(
      createSource({
        body: `LEVEL-2\n\n${nested.quote.text}`,
        subject: "RE: RE: feedback note please",
      })
    );

    if (!outer.ok) throw new Error(outer.reason);

    const text = outer.quote.text;
    expect(text.split(OUTLOOK_TEXT_RULE)).toHaveLength(3);
    expect(text.indexOf("Subject: RE: RE:")).toBeLessThan(text.indexOf("LEVEL-2"));
    expect(text.indexOf("LEVEL-2")).toBeLessThan(text.indexOf("LEVEL-1"));
  });

  it.each([
    ["quote_missing_headers", { quoteHeaders: undefined }],
    [
      "quote_missing_sender",
      { quoteHeaders: { from: " ", to: [], cc: [], sent: new Date("2026-10-28T17:29:00Z") } },
    ],
    ["quote_missing_date", { quoteHeaders: { from: "a@b.c", to: [], cc: [] } }],
    [
      "quote_missing_date",
      { quoteHeaders: { from: "a@b.c", to: [], cc: [], sent: new Date("x") } },
    ],
  ])("fails with %s instead of guessing", (reason, overrides) => {
    expect(buildQuotedHistory({ ...createSource({}), ...overrides })).toEqual({
      ok: false,
      reason,
    });
  });
});

/** Builds a QuoteSource fixture modelled on the 'feedback note please' Outlook thread. */
function createSource(overrides: {
  html?: string;
  body?: string;
  subject?: string;
  cc?: string[];
}): QuoteSource {
  return {
    quoteHeaders: {
      from: "Dhaliwal, MCpl Luffy <luffy@forces.gc.ca>",
      to: ["CAF-GPT <agent@caf-gpt.com>", "second@forces.gc.ca"],
      cc: overrides.cc ?? ["Ally <ally@forces.gc.ca>"],
      sent: new Date("2026-10-28T17:29:00Z"),
    },
    subject: overrides.subject ?? "RE: feedback note please",
    body: overrides.body ?? "Hello",
    html: overrides.html,
  };
}
