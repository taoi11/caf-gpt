/**
 * src/email/utils/QuotedSentLine.ts
 *
 * Reads the Outlook-style header block the user's client wrote above the message they replied
 * to, so CAF-GPT can learn the user's UTC offset from the zone-less Sent: line Outlook writes in
 * the user's local PC time. English (From/Sent/Date) and French (De/Envoyé/Date) labels, month
 * and day names are supported, in both the plain-text part and the HTML part converted to text.
 *
 * Top-level declarations:
 * - QUOTED_SENT_MIN_OFFSET_MINUTES / QUOTED_SENT_MAX_OFFSET_MINUTES: Range of real UTC offsets
 * - QUOTED_SENT_MAX_SKEW_MINUTES: Largest distance from a 15-minute offset still accepted as a match
 * - QuotedHeaderBlock: From and Sent values of the topmost quoted header block
 * - findTopQuotedHeader: Finds the topmost quoted From/Sent header block in an email body
 * - isSelfQuotedSender: Checks whether a quoted From value is CAF-GPT itself
 * - parseOutlookSentLine: Parses an English or French Outlook Sent: value as wall-clock time
 * - learnSentOffset: Offset (minutes, 15-minute steps) between a quoted wall-clock time and the real send time
 */

/** Real UTC offsets run from UTC-12:00 to UTC+14:00. */
export const QUOTED_SENT_MIN_OFFSET_MINUTES = -12 * 60;
export const QUOTED_SENT_MAX_OFFSET_MINUTES = 14 * 60;

/**
 * Largest distance (minutes) between the raw quoted-minus-sent difference and the nearest
 * 15-minute offset still accepted as a match. Outlook drops seconds and clocks drift slightly;
 * anything further is not the same message.
 */
export const QUOTED_SENT_MAX_SKEW_MINUTES = 5;

/** Lines after a From label searched for its Sent label. */
const HEADER_WINDOW_LINES = 8;

/** Longest Sent: value parsed; real Outlook values are well under this. */
const SENT_VALUE_MAX_LENGTH = 80;

/** From and Sent values of the topmost quoted header block. */
export interface QuotedHeaderBlock {
  from: string;
  sent: string;
}

const FROM_LABEL = /^(?:from|de)\s*:\s*(.*)$/i;
const SENT_LABEL = /^(?:sent|date|envoy[ée])\s*:\s*(.*)$/i;

const MONTHS: ReadonlyMap<string, number> = new Map([
  ["january", 0],
  ["february", 1],
  ["march", 2],
  ["april", 3],
  ["may", 4],
  ["june", 5],
  ["july", 6],
  ["august", 7],
  ["september", 8],
  ["october", 9],
  ["november", 10],
  ["december", 11],
  ["janvier", 0],
  ["février", 1],
  ["fevrier", 1],
  ["mars", 2],
  ["avril", 3],
  ["mai", 4],
  ["juin", 5],
  ["juillet", 6],
  ["août", 7],
  ["aout", 7],
  ["septembre", 8],
  ["octobre", 9],
  ["novembre", 10],
  ["décembre", 11],
  ["decembre", 11],
]);

const WEEKDAYS: ReadonlyMap<string, number> = new Map([
  ["sunday", 0],
  ["monday", 1],
  ["tuesday", 2],
  ["wednesday", 3],
  ["thursday", 4],
  ["friday", 5],
  ["saturday", 6],
  ["dimanche", 0],
  ["lundi", 1],
  ["mardi", 2],
  ["mercredi", 3],
  ["jeudi", 4],
  ["vendredi", 5],
  ["samedi", 6],
]);

const WEEKDAY_PREFIX = /^([a-zà-ÿ]+)\.?,?\s+(.*)$/;
/** "October 28, 2026 11:29 AM" / "October 28, 2026 at 11:29" (Outlook English). */
const MONTH_FIRST =
  /^([a-zà-ÿ]+)\.?\s+(\d{1,2}),?\s+(\d{4}),?(?:\s+at)?\s+(\d{1,2}):(\d{2})(?:\s*([ap])\.?\s?m\.?)?$/;
/** "28 octobre 2026 11:29" / "1er mars 2026 à 9 h 05" / "28 October 2026 11:29" (French, en-GB). */
const DAY_FIRST =
  /^(\d{1,2})(?:er)?\s+([a-zà-ÿ]+)\.?,?\s+(\d{4}),?(?:\s+(?:at|à))?\s+(\d{1,2})(?:\s*h\s*|:)(\d{2})(?:\s*([ap])\.?\s?m\.?)?$/;

/** Normalizes one body line: non-breaking spaces, quote markers, and bold asterisks. */
function normalizeLine(line: string): string {
  return line
    .replace(/[\u00a0\u2007\u202f]/g, " ")
    .replace(/^[>\s]+/, "")
    .replace(/\*/g, "")
    .trim();
}

/** A header label's value and the line index it was read from. */
interface LabelValue {
  value: string;
  index: number;
}

/** Returns a label's value, taking the next non-empty line when the label stands alone. */
function labelValue(lines: string[], index: number, inline: string): LabelValue {
  if (inline.trim().length > 0) return { value: inline.trim(), index };
  for (let next = index + 1; next < lines.length && next <= index + 2; next++) {
    if (lines[next].length > 0) return { value: lines[next], index: next };
  }
  return { value: "", index };
}

/**
 * Finds the topmost quoted header block: a From/De label followed within a few lines by a
 * Sent/Envoyé/Date label (before any other From label). This is the block the user's own client
 * wrote for the message they replied to; deeper blocks were written by earlier senders.
 * @param body - Plain-text email body (or HTML converted to text)
 */
export function findTopQuotedHeader(body: string): QuotedHeaderBlock | undefined {
  const lines = body.split(/\r?\n/).map(normalizeLine);
  for (let index = 0; index < lines.length; index++) {
    const fromMatch = FROM_LABEL.exec(lines[index]);
    if (!fromMatch) continue;
    const from = labelValue(lines, index, fromMatch[1]);
    const limit = Math.min(lines.length, from.index + 1 + HEADER_WINDOW_LINES);
    for (let next = from.index + 1; next < limit; next++) {
      if (FROM_LABEL.test(lines[next])) break;
      const sentMatch = SENT_LABEL.exec(lines[next]);
      if (sentMatch) {
        return { from: from.value, sent: labelValue(lines, next, sentMatch[1]).value };
      }
    }
  }
  return undefined;
}

/**
 * Checks whether a quoted From value is CAF-GPT itself: the CAF-GPT display name or one of its
 * own sending addresses.
 * @param from - Quoted From value, e.g. `CAF-GPT <agent@caf-gpt.com>`
 * @param selfAddresses - CAF-GPT's own normalized addresses
 */
export function isSelfQuotedSender(from: string, selfAddresses: readonly string[]): boolean {
  const value = from.toLowerCase().trim();
  const angle = value.indexOf("<");
  const name = (angle === -1 ? value : value.slice(0, angle)).replace(/["']/g, "").trim();
  if (name === "caf-gpt") return true;
  return selfAddresses.some((address) => {
    const own = address.toLowerCase();
    return value === own || value.includes(`<${own}>`);
  });
}

/**
 * Parses an Outlook Sent: value (English or French, optional weekday, 12- or 24-hour clock) and
 * returns its wall-clock time as epoch milliseconds read as if it were UTC. Returns undefined for
 * anything else, including an impossible date or a weekday that does not match the date.
 * @param value - Quoted Sent: value, e.g. `Wednesday, October 28, 2026 11:29 AM`
 */
export function parseOutlookSentLine(value: string): number | undefined {
  if (value.length > SENT_VALUE_MAX_LENGTH) return undefined;
  let text = value
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\u00a0\u2007\u202f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  let weekday: number | undefined;
  const prefix = WEEKDAY_PREFIX.exec(text);
  if (prefix && WEEKDAYS.has(prefix[1])) {
    weekday = WEEKDAYS.get(prefix[1]);
    text = prefix[2];
  }

  let monthName: string;
  let day: number;
  let rest: RegExpExecArray;
  const monthFirst = MONTH_FIRST.exec(text);
  const dayFirst = monthFirst ? null : DAY_FIRST.exec(text);
  if (monthFirst) {
    monthName = monthFirst[1];
    day = Number(monthFirst[2]);
    rest = monthFirst;
  } else if (dayFirst) {
    monthName = dayFirst[2];
    day = Number(dayFirst[1]);
    rest = dayFirst;
  } else {
    return undefined;
  }
  const month = MONTHS.get(monthName);
  const year = Number(rest[3]);
  let hour = Number(rest[4]);
  const minute = Number(rest[5]);
  const meridiem = rest[6];
  if (month === undefined || minute > 59) return undefined;
  if (meridiem) {
    if (hour < 1 || hour > 12) return undefined;
    hour = (hour % 12) + (meridiem === "p" ? 12 : 0);
  } else if (hour > 23) {
    return undefined;
  }

  const wallMs = Date.UTC(year, month, day, hour, minute);
  const check = new Date(wallMs);
  if (check.getUTCMonth() !== month || check.getUTCDate() !== day) return undefined;
  if (weekday !== undefined && check.getUTCDay() !== weekday) return undefined;
  return wallMs;
}

/**
 * Learns the user's UTC offset: quoted wall-clock time minus the real UTC send time, rounded to
 * the nearest 15 minutes. Returns undefined when the two cannot be the same message (outside real
 * UTC offsets, or more than QUOTED_SENT_MAX_SKEW_MINUTES from a 15-minute step).
 * @param quotedWallMs - parseOutlookSentLine result
 * @param sentAtMs - Real UTC send time CAF-GPT stored for that reply
 */
export function learnSentOffset(quotedWallMs: number, sentAtMs: number): number | undefined {
  const rawMinutes = (quotedWallMs - sentAtMs) / 60_000;
  const offset = Math.round(rawMinutes / 15) * 15;
  if (Math.abs(rawMinutes - offset) > QUOTED_SENT_MAX_SKEW_MINUTES) return undefined;
  if (offset < QUOTED_SENT_MIN_OFFSET_MINUTES || offset > QUOTED_SENT_MAX_OFFSET_MINUTES) {
    return undefined;
  }
  return offset === 0 ? 0 : offset;
}
