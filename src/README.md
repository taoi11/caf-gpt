# Email AI Agent System

## Project Structure

```text
src/
├── index.ts                    # Main entry point with HTTP + Agents SDK email routing
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
│   │   ├── ReplyRecipients.ts   # Outlook-style primary and reply-all recipient policy
│   │   └── ReplySubject.ts      # Single "Re: " reply subject normalization
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

- **postal-mime**: MIME parser for Cloudflare Email Worker inbound messages
- **agents**: Cloudflare Agents SDK for Durable Object-backed email routing, sending, state, and scheduling
- **ai** + **@ai-sdk/openai** + **workers-ai-provider**: Vercel AI SDK OpenAI Responses provider routed through the Cloudflare AI binding/Gateway
- **zod**: Schema validation for structured agent responses

## Cloudflare Bindings

- **R2_BUCKET**: R2 bucket for document storage (policies, prompts)
- **UserAgent**: Durable Object binding for per-user Agent state and scheduled memory updates
- **ASSETS**: Static assets binding for prompt templates
- **EMAIL**: Email Service binding used by `Agent.sendEmail()`; sender-restricted with no destination restriction

## Cloudflare AI Binding

- **AI**: Worker AI binding used by `workers-ai-provider/gateway` to route native OpenAI Responses requests through the `caf-gpt` AI Gateway

## Environment Variables (Secrets)

No Cloudflare REST API token is required; the legacy `CF_AIG_AUTH` Gateway secret is not used.

Inbound sender authorization is a code-reviewed policy in `src/config.ts`: `forces.gc.ca` plus the exact mailboxes `luffy@luffy.email` and `munshi@dhaliwal.info`. It has no deployment-variable override.

## Email Delivery Contract

Authorized inbound messages route directly to the `UserAgent` keyed by the normalized SMTP envelope sender; agent-routing headers are ignored. Successful responses use the official `Agent.sendEmail()` helper with the inbound monitored alias as `from`/`replyTo`, validated threading and subject headers, and a maximum of 50 combined recipients. Reply bodies carry only the answer and signature (no quoted history); `In-Reply-To`/`References` follow RFC 5322 and the subject gets a single `Re: ` prefix, so the mail client renders the conversation. Because replies no longer quote earlier turns, each answered turn (our reply plus the inbound email) is kept in the UserAgent's SQLite (30-day retention, pruned on read, write, and a daily schedule while any turn is stored; capped at 20 turns and 20,000 chars per block) and appended to Prime Foo's context when the user replies in the same thread. The Agents SDK email observability hook stays disabled because it would emit sender, recipient, and subject.

Before Prime Foo, a Clef (`@cf/cloudflare/clef`, 27B) choice gate screens each inbound email for prompt injection, jailbreaks, instruction overrides, data-exfiltration attempts, and spam/abuse. Only those are dropped (`no_reply`, reason `clef_suspected_injection`); legitimate member mail, including thanks, FYIs, and feedback-note requests, passes to Prime Foo, which decides how to respond. State over `CLEF_REPLY_MAX_STATE_BYTES` (60,000 UTF-8 bytes) fails closed (`clef_input_too_large`) because Clef would truncate it and screen only part of the email. A `<memory>` block is background notes, not trusted instructions.

### Email-path logging

Every inbound email is correlated by `emailRef`, a random 16-hex id the Worker generates per message and passes to `UserAgent` in the internal `x-caf-gpt-email-ref` header (overwriting any sender-supplied value), so both sides log the same value even when Message-ID is missing. Logs identify senders and recipients by domain only and never include addresses, subjects, bodies, attachment names, Message-IDs, prompts, model output, or raw error messages (errors log only an allowlisted `errorName`/`errorCode`; anything else is logged as `OtherError`/`other`).

- Worker: `Email routed` / `Email ignored - ...` (resolver), `Email handed off to UserAgent` (with `durationMs`), `Email rejected - no UserAgent route`, `Top-level email routing failed`.
- UserAgent: `Inbound email received by UserAgent`, one line per skip path (`Inbound email skipped by self-loop guard`, `Ignoring auto-reply or bounce email` with header categories, `Email content validation failed`, `Clef injection screen blocked Prime Foo` / `Clef injection screen allowed Prime Foo` with `choice`, `confidence`, `reason`), then exactly one terminal `Inbound email outcome` line with `outcome` (`replied` / `skipped` / `error`), `reason`, `durationMs`, and `errorReply` status when relevant.

Platform `invocation_logs` are disabled in `wrangler.jsonc` because the email invocation record indexes the full envelope `mailFrom`/`rcptTo`; Traces still record invocation outcome and timing.

Reply-all mirrors a normal email client: every valid, unique `Reply-To` mailbox is a primary `To` recipient, with RFC `From` used when no valid `Reply-To` mailbox remains. Original `To` then `Cc` addresses are retained in order as CC recipients after excluding `Bcc`, malformed or duplicate addresses, primary and sender identities, and CAF-GPT/self addresses. Valid external recipients are allowed.

Processing failures before `sendEmail()` begins attempt one generic plain-text, sender-only response through `Agent.replyToEmail()`. Once the normal send attempt begins, failures are logged and stop without a fallback reply. Top-level route/DO/RPC failures use generic `setReject()` and return. Duplicate inbound deliveries may produce duplicate work or replies; this is an accepted hobby-project tradeoff.
