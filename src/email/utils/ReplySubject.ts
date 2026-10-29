/**
 * src/email/utils/ReplySubject.ts
 *
 * Reply subject normalization
 *
 * Top-level declarations:
 * - stripReplyPrefixes: Returns the subject without leading reply prefixes
 * - normalizeReplySubject: Returns the subject with exactly one leading "Re: " prefix
 */

/** Leading reply prefixes, stacked or not: "Re:", "RE:", "Re[2]:", "AW:", "SV:", "Antw:". */
const REPLY_PREFIX_PATTERN = /^(?:\s*(?:re|aw|sv|antw)\s*(?:\[\d+\])?\s*:)+\s*/i;

/**
 * Returns the subject without any leading (stacked or localized) reply prefixes, trimmed.
 * @param subject - Inbound subject as parsed
 */
export function stripReplyPrefixes(subject: string): string {
  return subject.replace(REPLY_PREFIX_PATTERN, "").trim();
}

/**
 * Returns the subject with exactly one leading "Re: " prefix (RFC 5322 §3.6.5), collapsing any
 * stacked or localized reply prefixes so replies never become "Re: RE: Re: ...". Forward
 * markers after the reply prefix (e.g. "FW:") are kept as written.
 * @param subject - Inbound subject as parsed
 */
export function normalizeReplySubject(subject: string): string {
  const base = stripReplyPrefixes(subject);

  return base.length > 0 ? `Re: ${base}` : "Re:";
}
