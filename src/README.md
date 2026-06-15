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
│   │   └── ReplyRecipients.ts   # Safe reply-all recipient filtering for send_email flows
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
- **EMAIL**: Cloudflare Email Service send_email binding for outbound/proactive email, not direct inbound replies

## Environment Variables (Secrets)

- **AUTHORIZED_SENDERS**: Comma-separated list of authorized email domains/addresses (e.g., `forces.gc.ca,test@example.com`)
- **CF_AIG_AUTH**: Cloudflare AI Gateway authentication token
- **EMAIL_SECRET**: HMAC secret for signed Agents SDK email reply routing
