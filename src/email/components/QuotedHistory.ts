/**
 * src/email/components/QuotedHistory.ts
 *
 * Builds the Outlook-style quoted history written below the answer and signature in every
 * normal reply. The quote is the inbound email itself (its headers plus its full body), and that
 * body already carries the earlier history the sender's client quoted, so the whole chain carries
 * forward one level per reply. Nothing is rebuilt from storage.
 *
 * Top-level declarations:
 * - OUTLOOK_SENT_TIME_ZONE: Default time zone of the quoted Sent: line (nothing learned yet)
 * - SentZone: Zone the Sent: line is written in (fixed learned offset or an IANA zone)
 * - OUTLOOK_TEXT_RULE: Plain-text divider Outlook writes above a quoted header block
 * - QuoteHeaders: Display headers of the inbound email used for the quoted header block
 * - QuoteFailureReason: Fixed, content-free reasons the quote could not be built
 * - QuotedHistory: Built HTML/text quote plus content-free counts
 * - SanitizedHtml: Sanitized inbound HTML plus the dropped-node count
 * - QuotedHistoryResult: Built quote, or the fixed failure reason
 * - QuoteSource: Inbound fields the quote is built from
 * - formatOutlookMailbox: Formats parsed mailboxes as Outlook does (Name <address>)
 * - formatOutlookSentDate: Formats a date as Outlook's Sent: value in a SentZone
 * - sanitizeQuotedHtml: Allowlist sanitizer for inbound HTML embedded in the reply
 * - buildQuotedHistory: Builds the HTML and plain-text quote for one inbound email
 * - escapeHtml: Escapes text for HTML element content and attribute values
 * - textToOutlookHtml: Converts escaped plain text to Outlook MsoNormal paragraphs
 * - collapseHeaderValue: Folds a header value onto one line
 * - isAllowedUrl: Checks a link or image URL against the allowed schemes
 * - sanitizeStyle: Keeps only allowlisted CSS declarations with inert values
 * - styleFunctionNames: Linear scan for CSS function names in a declaration value
 * - renderNodes: Serializes allowlisted DOM nodes back to HTML
 * - renderElement: Serializes one element (dropped, unwrapped, or kept with safe attributes)
 */

import type { ChildNode, Element } from "domhandler";
import { parseDocument } from "htmlparser2";
import type { Address } from "postal-mime";

/** Default time zone of the quoted Sent: line, used only until the user's offset is known. */
export const OUTLOOK_SENT_TIME_ZONE = "America/Edmonton";

/**
 * Zone the quoted Sent: line is written in: a fixed UTC offset learned from the user's own
 * Outlook quote (agents/utils/SentTimeZone), or an IANA zone (the default).
 */
export type SentZone = { offsetMinutes: number } | { timeZone: string };

/** Plain-text divider Outlook writes above a quoted header block (32 underscores). */
export const OUTLOOK_TEXT_RULE = "________________________________";

/** Divider Outlook writes above a quoted header block in HTML replies. */
const OUTLOOK_HTML_RULE_STYLE =
  "border:none;border-top:solid #E1E1E1 1.0pt;padding:3.0pt 0cm 0cm 0cm";

/** Display headers of the inbound email, already formatted the way Outlook shows them. */
export interface QuoteHeaders {
  from: string;
  to: string[];
  cc: string[];
  /** Inbound Date header; undefined when missing or unparseable. */
  sent?: Date;
}

/** Fixed, content-free reasons the quote could not be built. */
export type QuoteFailureReason =
  | "quote_missing_headers"
  | "quote_missing_sender"
  | "quote_missing_date"
  | "quote_sanitize_failed";

/** Built HTML/text quote plus content-free counts for logs. */
export interface QuotedHistory {
  html: string;
  text: string;
  /** True when the inbound HTML body was embedded; false when its text body was escaped. */
  quotedHtml: boolean;
  /** UTF-8 byte length of the inbound body the quote embeds. */
  sourceBytes: number;
  /** Elements, comments, and attributes the sanitizer dropped. */
  removedNodes: number;
}

/** Sanitized inbound HTML plus the count of dropped elements, comments, and attributes. */
export interface SanitizedHtml {
  html: string;
  removedNodes: number;
}

/** Built quote, or the fixed failure reason. */
export type QuotedHistoryResult =
  | { ok: true; quote: QuotedHistory }
  | { ok: false; reason: QuoteFailureReason };

/** Inbound fields the quote is built from. */
export interface QuoteSource {
  quoteHeaders?: QuoteHeaders;
  subject: string;
  body: string;
  html?: string;
}

/** Elements kept (with allowlisted attributes); anything else not dropped is unwrapped. */
const ALLOWED_ELEMENTS: ReadonlySet<string> = new Set([
  "a",
  "abbr",
  "b",
  "big",
  "blockquote",
  "br",
  "caption",
  "center",
  "cite",
  "code",
  "col",
  "colgroup",
  "dd",
  "del",
  "div",
  "dl",
  "dt",
  "em",
  "font",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "ins",
  "kbd",
  "li",
  "ol",
  "p",
  "pre",
  "q",
  "s",
  "small",
  "span",
  "strike",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "tt",
  "u",
  "ul",
]);

/** Elements dropped with everything inside them (active content, document chrome, forms). */
const DROPPED_ELEMENTS: ReadonlySet<string> = new Set([
  "applet",
  "audio",
  "base",
  "button",
  "canvas",
  "embed",
  "form",
  "frame",
  "frameset",
  "head",
  "iframe",
  "input",
  "link",
  "math",
  "meta",
  "noscript",
  "object",
  "option",
  "param",
  "script",
  "select",
  "source",
  "style",
  "svg",
  "template",
  "textarea",
  "title",
  "track",
  "video",
  "xml",
]);

/** Void elements serialized without a closing tag. */
const VOID_ELEMENTS: ReadonlySet<string> = new Set(["br", "col", "hr", "img"]);

/** Presentational attributes kept as-is (href/src/style are checked separately). */
const ALLOWED_ATTRIBUTES: ReadonlySet<string> = new Set([
  "align",
  "alt",
  "bgcolor",
  "border",
  "cellpadding",
  "cellspacing",
  "class",
  "color",
  "colspan",
  "dir",
  "face",
  "height",
  "lang",
  "nowrap",
  "rowspan",
  "size",
  "span",
  "start",
  "title",
  "type",
  "valign",
  "width",
]);

const ALLOWED_LINK_PATTERN = /^(?:https?:|mailto:|tel:|#)/i;
const ALLOWED_IMAGE_PATTERN = /^(?:https?:|data:image\/(?:png|gif|jpeg|jpg|webp);base64,)/i;

/** Inline CSS properties kept (plus any `mso-*` Outlook property); all others are dropped. */
const ALLOWED_STYLE_PROPERTIES: ReadonlySet<string> = new Set([
  "background",
  "background-color",
  "border",
  "border-bottom",
  "border-bottom-color",
  "border-bottom-style",
  "border-bottom-width",
  "border-collapse",
  "border-color",
  "border-left",
  "border-left-color",
  "border-left-style",
  "border-left-width",
  "border-right",
  "border-right-color",
  "border-right-style",
  "border-right-width",
  "border-spacing",
  "border-style",
  "border-top",
  "border-top-color",
  "border-top-style",
  "border-top-width",
  "border-width",
  "color",
  "direction",
  "display",
  "font",
  "font-family",
  "font-size",
  "font-style",
  "font-variant",
  "font-weight",
  "height",
  "letter-spacing",
  "line-height",
  "list-style-type",
  "margin",
  "margin-bottom",
  "margin-left",
  "margin-right",
  "margin-top",
  "max-width",
  "min-width",
  "overflow-wrap",
  "padding",
  "padding-bottom",
  "padding-left",
  "padding-right",
  "padding-top",
  "table-layout",
  "text-align",
  "text-decoration",
  "text-indent",
  "text-transform",
  "vertical-align",
  "white-space",
  "width",
  "word-break",
  "word-wrap",
]);

/** Characters a kept CSS value may use: no escapes, comments, at-rules, or angle brackets. */
const SAFE_STYLE_VALUE_PATTERN = /^[a-z0-9#%.,\s"'\-+!/()]*$/i;
const STYLE_PROPERTY_PATTERN = /^-?[a-z][a-z0-9-]*$/;

/** The only CSS functions a kept value may call (colours); url(), image-set(), etc. are dropped. */
const ALLOWED_STYLE_FUNCTIONS: ReadonlySet<string> = new Set(["rgb", "rgba", "hsl", "hsla"]);

const OUTLOOK_SENT_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
};

const OUTLOOK_SENT_FORMATS = new Map<string, Intl.DateTimeFormat>();

/**
 * Formats parsed mailboxes the way Outlook's quoted header shows them: `Name <address>` when a
 * display name is present, otherwise the bare address. Group members are flattened.
 * @param addresses - postal-mime address list
 */
export function formatOutlookMailbox(addresses: Address[] | undefined): string[] {
  return (addresses ?? [])
    .flatMap((entry) => (entry.group ? entry.group : [entry]))
    .filter((mailbox) => mailbox.address.trim().length > 0)
    .map((mailbox) => {
      const name = collapseHeaderValue(mailbox.name);
      const address = collapseHeaderValue(mailbox.address);

      return name.length > 0 && name !== address ? `${name} <${address}>` : address;
    });
}

/**
 * Formats a date as Outlook's quoted Sent: value, for example `October 28, 2026 11:29 AM` (no
 * weekday, no "at", matching Outlook's reply header). A learned offset shifts the instant and
 * formats it as UTC wall-clock time; otherwise the IANA zone (default America/Edmonton) applies.
 * @param date - Inbound Date header value
 * @param zone - Zone to write the time in
 */
export function formatOutlookSentDate(
  date: Date,
  zone: SentZone = { timeZone: OUTLOOK_SENT_TIME_ZONE }
): string {
  const timeZone = "offsetMinutes" in zone ? "UTC" : zone.timeZone;

  const instant =
    "offsetMinutes" in zone ? new Date(date.getTime() + zone.offsetMinutes * 60_000) : date;

  let format = OUTLOOK_SENT_FORMATS.get(timeZone);

  if (!format) {
    format = new Intl.DateTimeFormat("en-US", { ...OUTLOOK_SENT_FORMAT_OPTIONS, timeZone });
    OUTLOOK_SENT_FORMATS.set(timeZone, format);
  }

  const parts = new Map(format.formatToParts(instant).map((part) => [part.type, part.value]));

  return `${parts.get("month")} ${parts.get("day")}, ${parts.get("year")} ${parts.get("hour")}:${parts.get("minute")} ${parts.get("dayPeriod")}`;
}

/**
 * Sanitizes inbound HTML for embedding in our reply. Allowlist only: scripts, styles, forms,
 * frames, media, and the inbound html/head/body wrappers are removed (body content is kept),
 * comments are dropped, unknown elements are unwrapped to their content, event handlers and
 * other unlisted attributes are dropped, links keep only http(s)/mailto/tel/# targets, images
 * keep only http(s) or inline raster data sources, and inline styles that can run code or load
 * resources are dropped. Text and attribute values are re-escaped on output.
 * @param html - Raw inbound HTML body
 */
export function sanitizeQuotedHtml(html: string): SanitizedHtml {
  const document = parseDocument(html, { decodeEntities: true, lowerCaseTags: true });
  const counter = { removed: 0 };

  return { html: renderNodes(document.children, counter), removedNodes: counter.removed };
}

/**
 * Builds the Outlook-style quote of one inbound email: a divider, the From/Sent/To/(Cc)/Subject
 * block, then the inbound body (sanitized HTML when present, otherwise escaped text). Fails with a
 * fixed reason instead of guessing when the headers, sender, or Date are missing.
 * @param source - Inbound headers and bodies
 * @param sentZone - Zone of the Sent: line (learned offset, saved offset, or the default)
 */
export function buildQuotedHistory(
  source: QuoteSource,
  sentZone: SentZone = { timeZone: OUTLOOK_SENT_TIME_ZONE }
): QuotedHistoryResult {
  const headers = source.quoteHeaders;

  if (!headers) return { ok: false, reason: "quote_missing_headers" };
  const from = collapseHeaderValue(headers.from);

  if (from.length === 0) return { ok: false, reason: "quote_missing_sender" };

  if (!headers.sent || Number.isNaN(headers.sent.getTime())) {
    return { ok: false, reason: "quote_missing_date" };
  }

  const sent = formatOutlookSentDate(headers.sent, sentZone);
  const to = headers.to.map(collapseHeaderValue).join("; ");
  const cc = headers.cc.map(collapseHeaderValue).join("; ");
  const subject = collapseHeaderValue(source.subject);
  const quotedHtml = (source.html ?? "").trim().length > 0;

  let bodyHtml: string;
  let removedNodes = 0;

  if (quotedHtml) {
    try {
      const sanitized = sanitizeQuotedHtml(source.html ?? "");
      bodyHtml = sanitized.html;
      removedNodes = sanitized.removedNodes;
    } catch {
      return { ok: false, reason: "quote_sanitize_failed" };
    }
  } else {
    bodyHtml = textToOutlookHtml(source.body);
  }

  const headerLines = [
    `<b>From:</b> ${escapeHtml(from)}`,
    `<b>Sent:</b> ${escapeHtml(sent)}`,
    `<b>To:</b> ${escapeHtml(to)}`,
    ...(cc.length > 0 ? [`<b>Cc:</b> ${escapeHtml(cc)}`] : []),
    `<b>Subject:</b> ${escapeHtml(subject)}`,
  ];

  const html = `<p class=MsoNormal>&nbsp;</p>
<div style='${OUTLOOK_HTML_RULE_STYLE}'>
<p class=MsoNormal>${headerLines.join("<br>\n")}</p>
</div>
<p class=MsoNormal>&nbsp;</p>
<div>
${bodyHtml}
</div>`;

  const textLines = [
    OUTLOOK_TEXT_RULE,
    `From: ${from}`,
    `Sent: ${sent}`,
    `To: ${to}`,
    ...(cc.length > 0 ? [`Cc: ${cc}`] : []),
    `Subject: ${subject}`,
  ];

  const text = `${textLines.join("\n")}\n\n${source.body.trim()}`;

  const sourceBytes = new TextEncoder().encode(
    quotedHtml ? (source.html ?? "") : source.body
  ).byteLength;

  return { ok: true, quote: { html, text, quotedHtml, sourceBytes, removedNodes } };
}

/** Escapes text for HTML element content and quoted attribute values. */
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Converts plain text to Outlook MsoNormal paragraphs, one per line, escaping every line. */
function textToOutlookHtml(text: string): string {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) =>
      line.trim().length > 0
        ? `<p class=MsoNormal>${escapeHtml(line)}</p>`
        : "<p class=MsoNormal>&nbsp;</p>"
    )
    .join("\n");
}

/** Folds a header value onto one line so it cannot add lines to the text header block. */
function collapseHeaderValue(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").trim();
}

/** Checks a link or image URL against the allowed schemes (ignoring leading whitespace/controls). */
function isAllowedUrl(value: string, pattern: RegExp): boolean {
  // Browsers ignore whitespace and control characters inside URL schemes ("java\tscript:").
  const compact = Array.from(value)
    .filter((character) => character.charCodeAt(0) > 0x20)
    .join("");

  return pattern.test(compact);
}

/**
 * Lists the CSS function names in a value, e.g. "rgb" for "rgb(1,2,3)".
 * Single pass per "(" so scanning stays linear in the value length.
 * @param value - CSS declaration value
 */
function styleFunctionNames(value: string): string[] {
  const names: string[] = [];
  let segmentStart = 0;

  for (let open = value.indexOf("("); open !== -1; open = value.indexOf("(", open + 1)) {
    let end = open;

    while (end > segmentStart && /\s/.test(value[end - 1])) end -= 1;
    let start = end;

    while (start > segmentStart && /[a-z-]/i.test(value[start - 1])) start -= 1;
    names.push(value.slice(start, end).toLowerCase());
    segmentStart = open + 1;
  }

  return names;
}

/**
 * Keeps only allowlisted inline CSS declarations whose values cannot run code or load resources:
 * no escapes, comments, or at-rules, and no functions other than rgb/rgba/hsl/hsla (so url(),
 * image-set(), expression() and the like are dropped). Returns undefined when nothing is kept.
 * @param value - Raw style attribute value (entities already decoded)
 * @param counter - Running count of dropped declarations
 */
function sanitizeStyle(value: string, counter: { removed: number }): string | undefined {
  const kept: string[] = [];

  for (const declaration of value.split(";")) {
    if (declaration.trim().length === 0) continue;
    const separator = declaration.indexOf(":");
    const property = declaration.slice(0, Math.max(separator, 0)).trim().toLowerCase();
    const propertyValue = declaration.slice(separator + 1).trim();

    const safe =
      separator > 0 &&
      STYLE_PROPERTY_PATTERN.test(property) &&
      (ALLOWED_STYLE_PROPERTIES.has(property) || property.startsWith("mso-")) &&
      SAFE_STYLE_VALUE_PATTERN.test(propertyValue) &&
      styleFunctionNames(propertyValue).every((name) => ALLOWED_STYLE_FUNCTIONS.has(name));

    if (safe) {
      kept.push(`${property}:${propertyValue}`);
    } else {
      counter.removed += 1;
    }
  }

  return kept.length > 0 ? kept.join(";") : undefined;
}

/**
 * Serializes nodes back to HTML, keeping only allowlisted elements and attributes.
 * @param nodes - Parsed child nodes
 * @param counter - Running count of dropped nodes and attributes
 */
function renderNodes(nodes: ChildNode[], counter: { removed: number }): string {
  let output = "";

  for (const node of nodes) {
    if (node.type === "text") {
      output += escapeHtml(node.data);
      continue;
    }

    if (node.type !== "tag" && node.type !== "script" && node.type !== "style") {
      // Comments, CDATA, doctype and processing instructions never reach the reply.
      counter.removed += 1;
      continue;
    }

    output += renderElement(node, counter);
  }

  return output;
}

/** Serializes one element: dropped, unwrapped to its children, or kept with safe attributes. */
function renderElement(element: Element, counter: { removed: number }): string {
  const name = element.name.toLowerCase();

  if (DROPPED_ELEMENTS.has(name)) {
    counter.removed += 1;

    return "";
  }

  if (!ALLOWED_ELEMENTS.has(name)) {
    // html/body/o:p and other unknown wrappers: keep their content, not the tag.
    return renderNodes(element.children, counter);
  }

  const attributes: string[] = [];

  for (const [rawName, value] of Object.entries(element.attribs)) {
    const attribute = rawName.toLowerCase();

    if (attribute === "style") {
      const style = sanitizeStyle(value, counter);

      if (style !== undefined) attributes.push(` style="${escapeHtml(style)}"`);
      continue;
    }

    const keep =
      ALLOWED_ATTRIBUTES.has(attribute) ||
      (attribute === "href" && name === "a" && isAllowedUrl(value, ALLOWED_LINK_PATTERN)) ||
      (attribute === "src" && name === "img" && isAllowedUrl(value, ALLOWED_IMAGE_PATTERN));

    if (keep) {
      attributes.push(` ${attribute}="${escapeHtml(value)}"`);
    } else {
      counter.removed += 1;
    }
  }

  if (name === "img" && !attributes.some((attribute) => attribute.startsWith(" src="))) {
    // An image without a safe source would only render as a broken placeholder.
    counter.removed += 1;

    return "";
  }

  const open = `<${name}${attributes.join("")}>`;

  if (VOID_ELEMENTS.has(name)) return open;

  return `${open}${renderNodes(element.children, counter)}</${name}>`;
}
