/**
 * src/email/components/index.ts
 *
 * Email components index - Export all email components
 *
 * Top-level exports:
 * - EmailComposer: Export EmailComposer from EmailComposer.ts
 * - HtmlEmailComposer: Export HtmlEmailComposer from HtmlEmailComposer.ts
 * - InboundReplyComposer: Export InboundReplyComposer from InboundReplyComposer.ts
 */

export { EmailComposer } from "./EmailComposer";
export { HtmlEmailComposer } from "./HtmlEmailComposer";
export {
  InboundReplyComposer,
  type InboundReplyMessage,
  type InboundReplySigningOptions,
} from "./InboundReplyComposer";
