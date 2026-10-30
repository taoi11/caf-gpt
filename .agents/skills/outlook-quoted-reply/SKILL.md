---
name: outlook-quoted-reply
description: Use when building, changing, debugging or reviewing the Outlook-style quoted history in CAF-GPT replies (the From/Sent/To/Cc/Subject block and inbound body below the answer), the learned time zone of the quoted Sent line, the quoted-HTML/CSS sanitizer, or the reply threading headers that ride alongside it.
---

# Outlook-style quoted reply history

How CAF-GPT quotes the earlier thread below every normal reply, the way classic Outlook on
Windows does. Built in #83, CSS allowlist hardened in #85 (plus a regression test in #88),
Sent-line time zone learned in #86. #89 only added JSDoc to lint helpers and does not touch this
path. Read the source files listed at the end before changing anything; this file is a map, the
code and tests are the contract.

## 1. Layout

The reply body is the answer (already ending with the CAF-GPT signature), then one quote of the
**inbound email only**: its headers plus its full body. That body already carries the chain the
sender's client quoted, so every earlier message stays below it, newest first, one level deeper
per reply. Nothing is rebuilt from storage (ThreadHistory is only Prime Foo context).

`buildQuotedHistory(source, sentZone)` in `src/email/components/QuotedHistory.ts` returns
`{ html, text, quotedHtml, sourceBytes, removedNodes }` or `{ ok: false, reason }`.

Header values come from `quoteHeaders`, built in `UserAgent.parseEmail` (`src/agents/UserAgent.ts`)
with `formatOutlookMailbox()`: `Name <address>` when a display name differs from the address,
else the bare address; groups are flattened. `To`/`Cc` are joined with `; `. `Sent` is only the
real `Date` header (`parsed.date`), never invented. Every header value goes through
`collapseHeaderValue()` (CR/LF/tab folded to a space) so it cannot add lines.

Sent format (`formatOutlookSentDate`): `October 28, 2026 11:29 AM`. No weekday, no "at",
`en-US`, 12-hour clock, in the zone from section 2.

Plain text (`OUTLOOK_TEXT_RULE` is 32 underscores; the `Cc:` line only when there is a Cc):

```text
<answer + signature as text>

________________________________
From: Name <address>
Sent: October 28, 2026 11:29 AM
To: A <a@x>; B <b@x>
Cc: C <c@x>
Subject: <inbound subject>

<inbound text body, trimmed>
```

HTML (as the code writes it; every value passes `escapeHtml()`):

```html
<p class=MsoNormal>&nbsp;</p>
<div style='border:none;border-top:solid #E1E1E1 1.0pt;padding:3.0pt 0cm 0cm 0cm'>
<p class=MsoNormal><b>From:</b> ...<br>
<b>Sent:</b> ...<br>
<b>To:</b> ...<br>
<b>Cc:</b> ...<br>
<b>Subject:</b> ...</p>
</div>
<p class=MsoNormal>&nbsp;</p>
<div>
<sanitized inbound HTML, or the text body as escaped <p class=MsoNormal> lines>
</div>
```

`HtmlEmailComposer.composeHtmlReply(answerHtml, quoteHtml)` wraps both inside the Word-style
`<div class=WordSection1>`, answer first, quote second. In `UserAgent.sendReply` the text part is
`` `${replyText}\n\n${quote.text}` ``. With no HTML part the inbound text body becomes one
`MsoNormal` paragraph per line (`&nbsp;` for blank lines).

## 2. Sent line in the user's learned time zone

Outlook writes the quoted Sent line in the user's local PC time with no zone, so CAF-GPT learns
the user's UTC offset from their own quote of our previous reply.

1. **Record our send time.** `UserAgent.sendReply` captures `sentAtMs = Date.now()` just before
   `sendEmail()`. After it succeeds, `recordSentTime` calls `recordReplySentTime()`, which stores
   it in the UserAgent Durable Object's SQLite table `cafgpt_reply_sent_times`
   (`message_id`, `sent_at`, `created_at`), keyed by the Message-ID `sendEmail()` returned.
2. **Find the user's quote of it.** `resolveSentZone()` (`src/agents/utils/SentTimeZone.ts`) calls
   `findTopQuotedHeader()` on the text body, else on `htmlToText(html)`. That is the topmost
   `From`/`De` line with a `Sent`/`Envoyé`/`Date` line in the next 8 lines: the block the user's own
   client wrote. It is used only when `isSelfQuotedSender()` says the From is CAF-GPT: the name
   `CAF-GPT`, or one of our addresses as `Name <addr>`, a bare or `mailto:` address, or the
   `Name (addr)` text that html-to-text writes for a linked sender. Codex flagged that last form on
   #86, fixed in 5258755. Nothing looser.
3. **Parse.** `parseOutlookSentLine()` reads English or French month/day names, an optional
   weekday (it must match the date), and a 12- or 24-hour clock, as wall-clock milliseconds.
4. **Match and learn.** It looks up the stored `sent_at` of the `In-Reply-To` id, else the single
   consistent `References` match. `learnSentOffset()` returns quoted minus sent, rounded to 15
   minutes. It returns nothing for more than 5 minutes of skew
   (`QUOTED_SENT_MAX_SKEW_MINUTES`) or outside UTC-12..+14.
5. **Save per user.** A learned offset formats the new block (`{ offsetMinutes }` shifts the
   instant and formats it as UTC). After a successful send, `saveSentOffset()` writes the one-row
   table `cafgpt_sent_offset` (`id = 1`, `offset_minutes`, `updated_at`). Each DO is one user,
   keyed by the normalized envelope sender.
6. **Default.** With no quoted CAF-GPT block, the saved offset is used. With none saved, the
   default is `OUTLOOK_SENT_TIME_ZONE = "America/Edmonton"` (Mountain Time, DST-aware via `Intl`).
7. **Retention.** `pruneSentTimes()` deletes rows past ThreadHistory's 30-day
   `THREAD_HISTORY_RETENTION_MS`, on the same daily `runThreadHistoryPrune` schedule.

**Parse-error logging.** When the topmost block is CAF-GPT's but teaches nothing,
`resolveQuotedSentZone` logs `Quoted Sent time zone not learned` at **error** level with only
`toLoggableSentZoneDiagnostics(decision)`: `quoteSentZoneSource` (`learned` | `saved` | `default`),
`quoteSentLineFound`, `quoteSentOffsetMinutes`, and `quoteSentReason`. The reason is one of
`quoted_sent_unparseable`, `quoted_sent_no_record`, `quoted_sent_unmatched`,
`quoted_sent_ambiguous` or `quoted_sent_storage_failed`. A thrown storage error also logs
`Quoted Sent time zone storage failed` with safe error metadata. This step is log-only by design
(#86): the reply still goes out with the saved offset or Edmonton. The same fields go on the
reply-accepted log, plus `sentTimeRecorded`. Only Message-IDs, send times and the offset are
stored, never quoted text. Logs never get quoted times, addresses or Message-IDs.

## 3. HTML/CSS allowlist (#83, hardened in #85)

`sanitizeQuotedHtml()` parses with `htmlparser2` and re-serializes **allowlist only**. Text and
attribute values are re-escaped on output, so stray closing tags cannot break out.

- **Dropped with contents** (`DROPPED_ELEMENTS`): script, style, head, title, meta, link, base,
  form controls, iframe/frame/frameset, object/embed/applet/param, svg, math, audio/video/source/
  track, canvas, template, noscript, xml. Comments, CDATA and doctype are dropped.
- **Unwrapped** (tag gone, children kept): anything not in `ALLOWED_ELEMENTS`, which includes the
  inbound html/body wrappers and Outlook's `o:p`.
- **Attributes**: only `ALLOWED_ATTRIBUTES` (presentational ones plus `class`, which keeps
  `MsoNormal`). Event handlers and everything else are dropped. `href` is kept only on `<a>` with
  http(s), mailto, tel or `#`. `src` is kept only on `<img>` with http(s) or
  `data:image/(png|gif|jpeg|jpg|webp);base64`. Schemes are checked after removing whitespace and
  control characters (`java\tscript:`). An `<img>` with no safe `src` is removed (so `cid:` images
  go).
- **Inline CSS** (`sanitizeStyle`) is checked one declaration at a time. A declaration is kept only
  if its property is in `ALLOWED_STYLE_PROPERTIES` or starts with `mso-`, its value matches
  `SAFE_STYLE_VALUE_PATTERN` (no backslash escapes, comments, `@` or angle brackets), and the only
  functions it calls are `rgb`, `rgba`, `hsl` or `hsla`.

Why: #83 shipped a substring blocklist for styles. Codex on promotion PR #84 showed
`image-set("https://…" 1x)` getting past it, a remote load (tracking pixel) from inside our own
reply. #85 replaced the blocklist with the per-declaration allowlist, so `url()`, `image-set()`,
`expression()`, `var()` and `calc()` all fail. #88 added a regression test showing the allowlist
also drops `-webkit-image-set`, uppercase `IMAGE-SET`, `cross-fade`, `element()`, `src()`, a
spaced `image (…)` and `@import`, even on allowlisted or `mso-*` properties. Codex on #85 then
found the function-name regex was quadratic on long values. 39f09fe replaced it with the linear
`styleFunctionNames()` scan, covered by the test "scans long CSS values in linear time"
(1,000,000 characters). Keep any new check linear. Outlook layout survives: `MsoNormal`,
`mso-*`, the `border-top:solid #E1E1E1 1.0pt` divider, fonts, colours, tables.

## 4. Threading headers (unchanged by the quote)

The quote changes only the bodies. `UserAgent.sendReply` builds the headers separately:

- `In-Reply-To` = the inbound Message-ID; `References` = the inbound References (or In-Reply-To)
  plus the inbound Message-ID (`buildThreadingOptions`, valid ids only).
- `Thread-Index` (a child: parent plus one 5-byte response level) and `Thread-Topic`, only when the
  inbound email has a valid Thread-Index (`buildOutlookThreadHeaders`,
  `src/email/utils/OutlookThreading.ts`, from #73). Exchange groups conversations by Thread-Index,
  not RFC 5322 headers.
- The subject gets exactly one `Re: ` (`normalizeReplySubject`).

#83 lists these as "not changed", and the workers test "quotes the inbound email below the
answer and signature in Outlook's layout" asserts `In-Reply-To`/`References` next to the quote.

**DND gateway:** the threading headers get through the DND (forces.gc.ca) mail gateway intact.
This was found on 2026-10-28 by reading the headers of a live test reply received on the DND
side, the same day #83 was started. It is in the project's working notes only: no PR, test or source
comment records it. #75's diagnostics (`threadTopicPresent`, `threadTopicMatches`,
`subjectHasTag`) exist to look into grouping problems without logging values. Do not remove or
rewrite these headers to "fix" quoting.

## 5. Rules

- **No fallbacks; fail loudly.** A missing header set, sender or real Date, or a sanitizer throw,
  returns a fixed `QuoteFailureReason` (`quote_missing_headers` | `quote_missing_sender` |
  `quote_missing_date` | `quote_sanitize_failed`). `sendReply` logs
  `Quoted history build failed` and throws `QuotedHistoryError` (an `EmailCompositionError`,
  `src/errors.ts`) **before** `markSendAttempted()`/`sendEmail()`. The user gets the error reply,
  never a quoteless one, and the outcome `reason` is the same code. The only intentional softness
  is the Sent zone (section 2): it is still logged at error level, and it falls back to a defined,
  tested default, not a guess.
- **Email text never goes in logs.** No bodies, subjects, addresses, Message-IDs, quoted times or
  prompts. Log only booleans, counts and allowlisted reason codes, through
  `src/email/utils/LogRedaction.ts`: `toLoggableQuoteDiagnostics` (`quotedHistoryIncluded`,
  `quotedHtml`, `quoteSourceBytes`, `quoteRemovedNodes`, `quoteFailureReason`) and
  `toLoggableSentZoneDiagnostics`. These are Zod schemas that `.catch()` anything off-enum. Error
  names pass `LOGGABLE_ERROR_NAMES` (`QuotedHistoryError` is listed). A new reason code means
  adding it to the type **and** the LogRedaction enum **and** a test.
- **Error replies stay light-hearted, with no error names or codes.** Text comes only from
  `ERROR_RESPONSE_TEMPLATES` in `src/email/utils/ErrorResponseTemplates.ts`; a quote failure gets
  the composition one ("I tried to write a reply and face-planted. Classic me."). Error replies go
  through `replyToEmail()`: text-only, sender-only and **unquoted**. They never use the composer,
  so a quote failure cannot suppress them. Once `sendEmail()` has started, a failure sends no
  second reply.

## 6. Files and tests

Source:
- `src/email/components/QuotedHistory.ts`: layout, Sent formatting, sanitizer, failure reasons
- `src/email/components/HtmlEmailComposer.ts`: HTML wrapper (answer, then quote)
- `src/agents/UserAgent.ts`: `parseEmail` (quoteHeaders), `sendReply`, `resolveQuotedSentZone`,
  `recordSentTime`, `classifyProcessingFailure`
- `src/agents/utils/SentTimeZone.ts`: DO SQLite tables, `resolveSentZone`, save/load/prune
- `src/email/utils/QuotedSentLine.ts`: top header finder, self-sender check, Sent parser,
  `learnSentOffset`
- `src/email/utils/LogRedaction.ts`, `src/errors.ts`, `src/email/utils/ErrorResponseTemplates.ts`
- `src/email/utils/OutlookThreading.ts`, `src/email/utils/ReplySubject.ts` (threading, unchanged)

Tests:
- `tests/unit/QuotedHistory.test.ts`: layout, Cc, escaping, nested chain, Edmonton DST, offsets,
  sanitizer, CSS allowlist, linear-time scan
- `tests/unit/QuotedSentLine.test.ts`: English/French text and HTML parsing, rounding, DST,
  self-sender (including linked names)
- `tests/unit/HtmlEmailComposer.test.ts`: quote placed after the signature
- `tests/unit/LogRedaction.test.ts`: quote and Sent-zone diagnostics allowlists
- `tests/workers/UserAgent.test.ts`: end-to-end quote and headers, learn/save/reuse offset, the
  fail-loud error reply
- `tests/workers/EmailPathLogging.test.ts`: content-free reply-accepted and failure logs

When changing behaviour, update the matching `AGENTS.md` bullet in "Email Replies" and the
module's JSDoc header (required by AGENTS.md). Then run `npm run format`, `npm run lint`,
`npm run test` and `npm run compile`.
