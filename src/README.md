# Email AI Agent System

## Project Structure

```text
src/
├── index.ts                    # Main entry point with HTTP + Agents SDK email routing
├── types.ts                    # TypeScript interfaces
├── email/
│   ├── components/              # Email processing components
│   │   ├── EmailComposer.ts     # Email composition with quoted content
│   │   ├── HtmlEmailComposer.ts # HTML reply composition
│   │   └── index.ts             # Component exports
│   ├── utils/                   # Email utilities
│   │   ├── EmailValidator.ts    # Email validation
│   │   ├── EmailNormalizer.ts   # Email address normalization
│   │   └── ReplyRecipients.ts   # Authorized primary and reply-all recipient policy
│   └── types.ts                 # Email type definitions
├── agents/
│   ├── UserAgent.ts             # Durable Object-backed per-user email agent
│   ├── AgentCoordinator.ts      # Prime_foo and sub-agent coordination
│   ├── BaseAgent.ts             # Base agent class with Workers AI integration
│   ├── PromptManager.ts         # Prompt management and caching
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
- **agents**: Cloudflare Agents SDK for Durable Object-backed email routing, state, and scheduling
- **ai** + **ai-gateway-provider**: Vercel AI SDK with Cloudflare AI Gateway provider
- **zod**: Schema validation for structured agent responses

## Cloudflare Bindings

- **R2_BUCKET**: R2 bucket for document storage (policies, prompts)
- **UserAgent**: Durable Object binding for per-user Agent state and scheduled memory updates
- **ASSETS**: Static assets binding for prompt templates
- **EMAIL**: Structured Email Service binding for signed successful replies; sender-restricted with no destination restriction

## Environment Variables (Secrets)

- **AUTHORIZED_SENDERS**: Required, nonblank comma-separated list of valid email domains/addresses (e.g., `forces.gc.ca,test@example.com`); there is no fallback allowlist
- **CF_AIG_AUTH**: Cloudflare AI Gateway authentication token
- **EMAIL_SECRET**: HMAC secret for signed Agents SDK email reply routing

## Email Delivery Contract

Successful responses generate canonical signed `user-agent` routing headers through `signAgentHeaders()` and call `env.EMAIL.send()` directly with the inbound monitored alias as `from`/`replyTo`, strict control-free threading/subject headers, and a maximum of 50 combined recipients. `Agent.sendEmail()` is intentionally unused so its address/subject-bearing outbound SDK observability is not emitted. The normalized SMTP envelope sender must equal RFC `From` and any single `Reply-To`; no header-only delegated identity is supported. Signed routing is accepted only for canonical `user-agent` routes whose agent id matches that same envelope principal. Reply-all candidates come only from original `To` then `Cc`; `Bcc`, malformed, unauthorized, duplicate, sender, self, and CAF-GPT-domain addresses are removed.

Every delivery reads inbound raw bytes once and reserves an opaque SHA-256 fingerprint of normalized envelope identity plus those bytes before MIME parsing, validation, or recipient resolution. If raw reading fails, it reserves the best stable SHA-256 fallback from normalized envelope identity, raw size, and available header entries without logging or storing those inputs. The ledger retains at most 128 rows for 30 days and moves `processing → send_started → sent`; a structured-send exception becomes `send_unknown`. Retries find the existing row and return without another AI call, successful reply, sender-only error reply, or memory schedule. This gives at-most-once delivery: ambiguous sends and isolate termination may lose a response, but do not create duplicates while retained. Memory tasks use stable fingerprint-bearing payloads with SDK idempotency enabled.

Deterministic processing failures before `send_started` attempt exactly one ledger-guarded plain-text `AgentEmail.reply()` to the authorized envelope sender. Once structured sending starts, exceptions are treated as ambiguous and never trigger a second inbound reply. Top-level route/DO/RPC failures use generic `setReject()` and return. Application-owned `Logger` output retains only safe classifications, domains, correlation/stage data, timing, and counts—not mailbox addresses, subjects, message content, headers, model identifiers or output, secrets, or exception text. Separately, pre-existing Agents SDK inbound `email:receive` observability may include `from`, `to`, and `subject` when platform traces are enabled; direct outbound binding sends avoid adding SDK `email:send` events.
