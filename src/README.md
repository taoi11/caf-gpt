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
│   │   └── ReplyRecipients.ts   # Outlook-style primary and reply-all recipient policy
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

Inbound sender authorization is a code-reviewed policy in `src/config.ts`: `forces.gc.ca` plus the exact mailbox `luffy@luffy.email`. It has no deployment-variable override.

## Email Delivery Contract

Authorized inbound messages route directly to the `UserAgent` keyed by the normalized SMTP envelope sender; agent-routing headers are ignored. Successful responses use the official `Agent.sendEmail()` helper with the inbound monitored alias as `from`/`replyTo`, validated threading and subject headers, and a maximum of 50 combined recipients. The Agents SDK email observability hook is disabled while application logging remains basic.

Reply-all mirrors a normal email client: every valid, unique `Reply-To` mailbox is a primary `To` recipient, with RFC `From` used when no valid `Reply-To` mailbox remains. Original `To` then `Cc` addresses are retained in order as CC recipients after excluding `Bcc`, malformed or duplicate addresses, primary and sender identities, and CAF-GPT/self addresses. Valid external recipients are allowed.

Processing failures before `sendEmail()` begins attempt one generic plain-text, sender-only response through `Agent.replyToEmail()`. Once the normal send attempt begins, failures are logged and stop without a fallback reply. Top-level route/DO/RPC failures use generic `setReject()` and return. Duplicate inbound deliveries may produce duplicate work or replies; this is an accepted hobby-project tradeoff.
