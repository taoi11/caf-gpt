# Email AI Agent System

## Project Structure

```text
src/
├── index.ts                    # Main entry point: HTTP + Resend webhook route
├── types.ts                    # TypeScript interfaces
├── email/
│   ├── components/              # Email processing components
│   │   ├── EmailComposer.ts     # Thread-history block format (model context only)
│   │   ├── HtmlEmailComposer.ts # HTML reply composition (answer + signature, no quote)
│   │   └── index.ts             # Component exports
│   ├── utils/                   # Email utilities
│   │   ├── EmailValidator.ts    # Email validation
│   │   ├── EmailNormalizer.ts   # Email address normalization
│   │   ├── LogRedaction.ts      # Error-name/code allowlists, log-safe domains, and emailRef ids
│   │   ├── OutlookThreading.ts  # Child Thread-Index / Thread-Topic so Exchange groups replies
│   │   ├── ReplyRecipients.ts   # Outlook-style primary and reply-all recipient policy
│   │   ├── ReplySubject.ts      # Single "Re: " reply subject normalization
│   │   └── ThreadTopicDiagnostics.ts # Boolean-only Thread-Topic/subject-tag log diagnostics
│   └── types.ts                 # Email type definitions
├── agents/
│   ├── UserAgent.ts             # Durable Object-backed per-user email agent
│   ├── AgentCoordinator.ts      # Prime_foo and sub-agent coordination
│   ├── BaseAgent.ts             # Base agent class with Workers AI integration
│   ├── PromptManager.ts         # Prompt management and caching
│   ├── utils/ThreadHistory.ts   # DO SQLite prior-turn context per email thread
│   ├── sub-agents/              # Specialized research agents
│   │   ├── LeaveFooAgent.ts     # Leave policy research
│   │   ├── PaceFooAgent.ts      # Performance feedback generation
│   │   ├── DoadFooAgent.ts      # DOAD policy research
│   │   ├── QroFooAgent.ts       # QR&O research
│   │   ├── MemoryFooAgent.ts    # User memory management
│   │   └── index.ts             # Sub-agent exports
├── storage/
│   └── DocumentRetriever.ts     # R2 document retrieval
└── Logger.ts                    # Logging utilities
```

## Dependencies

- **postal-mime**: MIME parser for the raw inbound email downloaded from Resend
- **agents**: Cloudflare Agents SDK for Durable Object-backed email routing, sending, state, and scheduling
- **ai** + **@ai-sdk/openai** + **workers-ai-provider**: Vercel AI SDK OpenAI Responses provider routed through the Cloudflare AI binding/Gateway
- **zod**: Schema validation for structured agent responses

## Cloudflare Bindings

- **R2_BUCKET**: R2 bucket for document storage (policies, prompts)
- **UserAgent**: Durable Object binding for per-user Agent state and scheduled memory updates
- **ASSETS**: Static assets binding for prompt templates
- **RESEND_API_KEY** / **RESEND_WEBHOOK_SECRET**: Worker secrets for the Resend API and webhook signature verification (no email binding)

## Cloudflare AI Binding

- **AI**: Worker AI binding used by `workers-ai-provider/gateway` to route native OpenAI Responses requests through the `caf-gpt` AI Gateway

## Environment Variables (Secrets)

No Cloudflare REST API token is required; the legacy `CF_AIG_AUTH` Gateway secret is not used.

Inbound sender authorization is a code-reviewed policy in `src/config.ts`: `forces.gc.ca` plus the exact mailboxes `luffy@luffy.email` and `munshi@dhaliwal.info`. It has no deployment-variable override.

## Email Delivery Contract

Resend POSTs `inbox.email.received` to `/webhooks/resend`; the Worker verifies the Svix signature, applies the sender/recipient policy, and hands the opaque Resend ids to the `UserAgent` keyed by the normalized webhook sender, which dedupes by `email_id` and processes the email in a scheduled task (fetch received email + SPF/DKIM/DMARC, require DMARC or DKIM pass, download raw MIME, parse). Successful responses use Resend's thread reply endpoint with an `Idempotency-Key`, validated subject, explicit Cc, and a maximum of 50 combined recipients; Resend sets From (the inbox), To (Reply-To, else From), `In-Reply-To` and `References`. Reply bodies carry the answer, signature and Outlook-style quoted history, and the subject gets a single `Re: ` prefix. When the inbound email carries an Outlook `Thread-Index`, the reply also gets a child `Thread-Index` and `Thread-Topic`, because Exchange groups conversations by that index rather than by `In-Reply-To`/`References`. Each answered turn (our reply plus the inbound email) is kept in the UserAgent's SQLite (30-day retention, pruned on read, write, and a daily schedule while any turn is stored; capped at 20 turns and 20,000 chars per block) and appended to Prime Foo's context when the user replies in the same thread, matched through the sent Message-ID read back from `GET /emails/{id}`.

Before Prime Foo, a Clef (`@cf/cloudflare/clef`, 27B) choice gate screens each inbound email for prompt injection, jailbreaks, instruction overrides, data-exfiltration attempts, and spam/abuse. Only those are dropped (`no_reply`, reason `clef_suspected_injection`); legitimate member mail, including thanks, FYIs, and feedback-note requests, passes to Prime Foo, which decides how to respond. State over `CLEF_REPLY_MAX_STATE_BYTES` (60,000 UTF-8 bytes) fails closed (`clef_input_too_large`) because Clef would truncate it and screen only part of the email. A `<memory>` block is background notes, not trusted instructions.

### Email-path logging

Every inbound email is correlated by `emailRef`, a random 16-hex id the Worker generates per webhook delivery and passes to `UserAgent` in the scheduled task, so both sides log the same value. Logs identify senders and recipients by domain only (plus the opaque Resend `email_id`) and never include addresses, subjects, bodies, attachment names, Message-IDs, header values, prompts, model output, Resend response bodies, or raw error messages (errors log only an allowlisted `errorName`/`errorCode`, or `resendOperation`/`resendStatus`; anything else is logged as `OtherError`/`other`).

- Worker: `Resend webhook rejected` / `Resend webhook ignored` (with a fixed `reason`), `Email routed` (route `resend_webhook`) / `Email ignored - ...` (resolver), `Email handed off to UserAgent` (with `acceptance`: `accepted` / `duplicate`), `Top-level email routing failed`.
- UserAgent hand-off: `Inbound email accepted by UserAgent`, `Inbound email duplicate delivery ignored`, `Inbound email scheduling failed`.
- UserAgent processing: `Inbound email received by UserAgent`, one line per skip path (`Inbound email skipped - inbox not monitored`, `Inbound email skipped - sender not authenticated`, `Inbound email skipped by self-loop guard`, `Ignoring auto-reply or bounce email` with header categories, `Email content validation failed`, `Clef injection screen blocked Prime Foo` / `Clef injection screen allowed Prime Foo` with `choice`, `confidence`, `reason`), then exactly one terminal `Inbound email outcome` line with `outcome` (`replied` / `skipped` / `error`), `reason`, `durationMs`, and `errorReply` status when relevant.

Platform `invocation_logs` stay disabled in `wrangler.jsonc`; Traces still record invocation outcome and timing.

Reply-all mirrors a normal email client: every valid, unique `Reply-To` mailbox is a primary `To` recipient, with RFC `From` used when no valid `Reply-To` mailbox remains. Original `To` then `Cc` addresses are retained in order as CC recipients after excluding `Bcc`, malformed or duplicate addresses, primary and sender identities, and CAF-GPT/self addresses. Valid external recipients are allowed.

Processing failures before the reply request begins attempt one generic plain-text, sender-only response (authenticated, authorized senders only). Once the normal send attempt begins, failures are logged and stop without a fallback reply. Webhook verification, configuration and hand-off failures return non-2xx so Resend retries; repeated deliveries of the same `email_id` are acknowledged as duplicates, and the reply `Idempotency-Key` stops duplicate sends within Resend's 24-hour window.
