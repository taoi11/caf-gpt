/**
 * tests/unit/QuotedSentLine.test.ts
 *
 * Unit tests for reading the user's own Outlook quote of a CAF-GPT reply and learning the UTC
 * offset of its zone-less Sent: line
 *
 * Top-level declarations:
 * - parseOutlookSentLine suite: English and French formats, 12/24-hour clocks, invalid values
 * - learnSentOffset suite: 15-minute rounding, half-hour zones, DST, skew and range rejection
 * - findTopQuotedHeader suite: Plain-text, HTML-converted, French, label-alone, and nested layouts
 * - isSelfQuotedSender suite: CAF-GPT display name and own addresses, incl. linked HTML senders
 */

import { describe, expect, it } from "vitest";
import { htmlToText } from "../../src/email/utils/HtmlToText";
import {
  findTopQuotedHeader,
  isSelfQuotedSender,
  learnSentOffset,
  parseOutlookSentLine,
} from "../../src/email/utils/QuotedSentLine";

const wall = (iso: string) => Date.parse(`${iso}Z`);

describe("parseOutlookSentLine", () => {
  it.each([
    ["Wednesday, October 28, 2026 11:29 AM", "2026-10-28T11:29:00"],
    ["October 28, 2026 11:29 AM", "2026-10-28T11:29:00"],
    ["October 21, 2026 1:10 PM", "2026-10-21T13:10:00"],
    ["October 28, 2026 12:05 AM", "2026-10-28T00:05:00"],
    ["October 28, 2026 12:30 PM", "2026-10-28T12:30:00"],
    ["Wednesday, October 28, 2026 at 11:29 AM", "2026-10-28T11:29:00"],
    ["October 28, 2026 23:15", "2026-10-28T23:15:00"],
    ["Wednesday, 28 October 2026 14:30", "2026-10-28T14:30:00"],
    ["mercredi 28 octobre 2026 11:29", "2026-10-28T11:29:00"],
    ["Mercredi, 28 octobre 2026 à 11 h 29", "2026-10-28T11:29:00"],
    ["dimanche 1er mars 2026 09:05", "2026-03-01T09:05:00"],
    ["samedi 1 août 2026 18:00", "2026-08-01T18:00:00"],
    ["lundi 21 decembre 2026 7:45", "2026-12-21T07:45:00"],
    ["jeudi\u00a012\u00a0février\u00a02026 08:00", "2026-02-12T08:00:00"],
  ])("parses %s", (value, expected) => {
    expect(parseOutlookSentLine(value)).toBe(wall(expected));
  });

  it.each([
    "",
    "sometime soon",
    "Thursday, October 28, 2026 11:29 AM",
    "February 30, 2026 10:00 AM",
    "October 28, 2026 13:10 PM",
    "October 28, 2026 24:00",
    "Octember 28, 2026 11:29 AM",
    "10/28/2026 11:29 AM",
    "October 28, 2026 11:29 AM MDT",
    `October 28, 2026 11:29 AM${" ".repeat(100)}x`,
  ])("rejects %j", (value) => {
    expect(parseOutlookSentLine(value)).toBeUndefined();
  });
});

describe("learnSentOffset", () => {
  const sentAt = Date.parse("2026-10-28T17:30:20Z");

  it.each([
    // Outlook drops seconds, so the quoted minute is up to a minute behind the real send time.
    ["2026-10-28T11:30:00", -360],
    ["2026-10-28T14:30:00", -180],
    ["2026-10-28T15:00:00", -150],
    ["2026-10-28T23:00:00", 330],
    ["2026-10-28T17:30:00", 0],
    ["2026-10-28T11:33:00", -360],
    ["2026-10-28T11:26:00", -360],
  ])("learns %s against 17:30:20Z as %i minutes", (quoted, expected) => {
    expect(learnSentOffset(wall(quoted), sentAt)).toBe(expected);
  });

  it("learns each side of a DST change from that thread's own send time", () => {
    // Edmonton: MDT (UTC-6) before 2026-11-01 08:00Z, MST (UTC-7) after.
    expect(learnSentOffset(wall("2026-10-31T12:00:00"), Date.parse("2026-10-31T18:00:00Z"))).toBe(
      -360
    );
    expect(learnSentOffset(wall("2026-11-02T11:00:00"), Date.parse("2026-11-02T18:00:00Z"))).toBe(
      -420
    );
  });

  it.each([
    ["2026-10-28T11:37:00", "between 15-minute steps"],
    ["2026-10-28T11:23:00", "between 15-minute steps"],
    ["2026-10-27T03:00:00", "beyond UTC-12"],
    ["2026-10-29T08:00:00", "beyond UTC+14"],
  ])("rejects %s (%s)", (quoted) => {
    expect(learnSentOffset(wall(quoted), sentAt)).toBeUndefined();
  });
});

describe("findTopQuotedHeader", () => {
  it("reads the topmost block of a plain-text Outlook reply", () => {
    const body = [
      "Thanks, that works.",
      "",
      "________________________________",
      "From: CAF-GPT <agent@caf-gpt.com>",
      "Sent: Wednesday, October 28, 2026 11:30 AM",
      "To: Dhaliwal, MCpl Luffy <luffy@forces.gc.ca>",
      "Subject: Re: Leave",
      "",
      "Answer",
      "",
      "From: Dhaliwal, MCpl Luffy <luffy@forces.gc.ca>",
      "Sent: October 28, 2026 11:29 AM",
    ].join("\n");

    expect(findTopQuotedHeader(body)).toEqual({
      from: "CAF-GPT <agent@caf-gpt.com>",
      sent: "Wednesday, October 28, 2026 11:30 AM",
    });
  });

  it("reads labels standing alone with blank lines, as in a real Outlook HTML reply", () => {
    const body = [
      "Reply text",
      "",
      "From:",
      "CAF-GPT <agent@caf-gpt.com>",
      "",
      "Sent: October 21, 2026 1:10 PM",
      "",
      "To: Dhaliwal, MCpl Luffy <luffy@forces.gc.ca>",
    ].join("\n");

    expect(findTopQuotedHeader(body)).toEqual({
      from: "CAF-GPT <agent@caf-gpt.com>",
      sent: "October 21, 2026 1:10 PM",
    });
  });

  it("reads the HTML variant after conversion to text", () => {
    const html =
      "<div class=WordSection1><p class=MsoNormal>Merci</p>" +
      "<div style='border:none;border-top:solid #E1E1E1 1.0pt;padding:3.0pt 0cm 0cm 0cm'>" +
      "<p class=MsoNormal><b>De&nbsp;:</b> CAF-GPT &lt;agent@caf-gpt.com&gt;<br>" +
      "<b>Envoy&eacute;&nbsp;:</b> mercredi 28 octobre 2026 11:30<br>" +
      "<b>&Agrave;&nbsp;:</b> Luffy &lt;luffy@forces.gc.ca&gt;<br>" +
      "<b>Objet&nbsp;:</b> RE: Cong&eacute;</p></div></div>";

    expect(findTopQuotedHeader(htmlToText(html))).toEqual({
      from: "CAF-GPT <agent@caf-gpt.com>",
      sent: "mercredi 28 octobre 2026 11:30",
    });
  });

  it("reads French plain text with non-breaking spaces, quote markers, and bold markers", () => {
    const body = [
      "Merci",
      "> *De\u00a0:* CAF-GPT <agent@caf-gpt.com>",
      "> *Envoyé\u00a0:* mercredi 28 octobre 2026 11:30",
      "> *À\u00a0:* Luffy",
    ].join("\n");

    expect(findTopQuotedHeader(body)).toEqual({
      from: "CAF-GPT <agent@caf-gpt.com>",
      sent: "mercredi 28 octobre 2026 11:30",
    });
  });

  it("ignores a From line with no Sent line nearby and finds none in a first email", () => {
    expect(findTopQuotedHeader("From: the CO\nPlease draft a note.")).toBeUndefined();
    expect(findTopQuotedHeader("Hello Agent,\nGet me a feedback note.")).toBeUndefined();
  });
});

describe("isSelfQuotedSender", () => {
  const self = ["agent@caf-gpt.com", "pacenote@caf-gpt.com"];

  it.each([
    ["CAF-GPT <agent@caf-gpt.com>", true],
    ['"CAF-GPT" <other@caf-gpt.com>', true],
    ["CAF-GPT", true],
    ["Someone <PaceNote@caf-gpt.com>", true],
    ["agent@caf-gpt.com", true],
    ["Dhaliwal, MCpl Luffy <luffy@forces.gc.ca>", false],
    ["CAF-GPT fan club <fans@example.com>", false],
    ["Mallory <mallory@example.com> agent@caf-gpt.com", false],
    ["CAF-GPT (agent@caf-gpt.com)", true],
    ["Someone (MAILTO:PaceNote@caf-gpt.com)", true],
    ["Someone (mailto:agent@caf-gpt.com?subject=x)", true],
    ['"Someone" <mailto:agent@caf-gpt.com (agent@caf-gpt.com)>', true],
    ["mailto:agent@caf-gpt.com", true],
    ["Mallory (mallory@example.com)", false],
    ["CAF-GPT fan club (fans@example.com)", false],
    ["Mallory (agent@caf-gpt.com.example.com)", false],
    ["Mallory (mallory@example.com) (agent)", false],
    ["Mallory <mailto:mallory@example.com (agent@caf-gpt.com)>", false],
    ["Mallory <agent@caf-gpt.com> (mallory@example.com)", false],
  ])("%s -> %s", (from, expected) => {
    expect(isSelfQuotedSender(from, self)).toBe(expected);
  });

  it.each([
    [
      "English",
      "<b>From:</b> <a href='mailto:agent@caf-gpt.com'>CAF-GPT</a><br>" +
        "<b>Sent:</b> Wednesday, October 28, 2026 2:30 PM<br>",
      "Wednesday, October 28, 2026 2:30 PM",
    ],
    [
      "French",
      "<b>De&nbsp;:</b> <a href=\"mailto:agent@caf-gpt.com\">CAF-GPT</a><br>" +
        "<b>Envoy&eacute;&nbsp;:</b> mercredi 28 octobre 2026 14:30<br>",
      "mercredi 28 octobre 2026 14:30",
    ],
  ])("matches a %s HTML header whose sender is a mailto link", (_language, header, sent) => {
    const html =
      "<div class=WordSection1><p class=MsoNormal>Thanks</p>" +
      "<div style='border:none;border-top:solid #E1E1E1 1.0pt;padding:3.0pt 0cm 0cm 0cm'>" +
      `<p class=MsoNormal>${header}<b>To:</b> Luffy &lt;luffy@forces.gc.ca&gt;</p></div></div>`;

    const block = findTopQuotedHeader(htmlToText(html));

    expect(block).toEqual({ from: "CAF-GPT (agent@caf-gpt.com)", sent });
    expect(isSelfQuotedSender(block?.from ?? "", self)).toBe(true);
  });

  it("rejects a linked sender that is not CAF-GPT", () => {
    const html =
      "<p><b>From:</b> <a href='mailto:mallory@example.com'>Mallory</a><br>" +
      "<b>Sent:</b> October 28, 2026 2:30 PM</p>";

    const block = findTopQuotedHeader(htmlToText(html));

    expect(block?.from).toBe("Mallory (mallory@example.com)");
    expect(isSelfQuotedSender(block?.from ?? "", self)).toBe(false);
  });
});
