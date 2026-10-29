/**
 * src/email/components/index.ts
 *
 * Email components index - Export all email components
 *
 * Top-level exports:
 * - formatQuotedContent: Export formatQuotedContent (model-context history block) from EmailComposer.ts
 * - HtmlEmailComposer: Export HtmlEmailComposer from HtmlEmailComposer.ts
 * - buildQuotedHistory / formatOutlookMailbox: Export the reply quoted-history builders from QuotedHistory.ts
 */

export { formatQuotedContent } from "./EmailComposer";

export { HtmlEmailComposer } from "./HtmlEmailComposer";

export { buildQuotedHistory, formatOutlookMailbox } from "./QuotedHistory";
