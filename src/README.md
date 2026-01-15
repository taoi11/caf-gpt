# Email AI Agent System

## Project Structure

```
src/
├── index.ts                    # Main entry point with HTTP webhook handler
├── types.ts                    # TypeScript interfaces
├── webhooks/
│   ├── ResendWebhookHandler.ts # Resend webhook processing and authorization
│   └── types.ts                # Webhook event and API response types
├── email/
│   ├── SimpleEmailHandler.ts   # Email processing and orchestration
│   ├── ResendEmailSender.ts    # Email sending via Resend API with CC support
│   ├── components/              # Email processing components
│   │   ├── EmailComposer.ts     # Email composition with quoted content
│   │   ├── EmailThreadManager.ts # Threading headers (In-Reply-To, References)
│   │   └── index.ts             # Component exports
│   ├── errors/                  # Custom error classes
│   │   └── index.ts             # All email error classes (consolidated)
│   ├── utils/                   # Email utilities
│   │   ├── EmailValidator.ts    # Email validation
│   │   └── EmailNormalizer.ts   # Email address normalization
│   └── types.ts                 # Email type definitions
├── agents/
│   ├── AgentCoordinator.ts      # Prime_foo and sub-agent coordination
│   ├── BaseAgent.ts             # Base agent class with LangChain integration
│   ├── PromptManager.ts         # Prompt management and caching
│   ├── middleware/              # Agent middleware
│   │   ├── iterationTracker.ts  # Circuit breaker for sub-agent calls
│   │   └── index.ts             # Middleware exports
│   ├── sub-agents/              # Specialized research agents
│   │   ├── LeaveFooAgent.ts     # Leave policy research
│   │   ├── PaceFooAgent.ts      # Performance feedback generation
│   │   ├── DoadFooAgent.ts      # DOAD policy research
│   │   ├── QroFooAgent.ts       # QR&O research
│   │   ├── MemoryFooAgent.ts    # User memory management
│   │   └── index.ts             # Sub-agent exports
│   └── tools/                   # Agent tools
│       ├── researchTools.ts     # Research tool definitions
│       ├── feedbackNoteTool.ts  # Feedback note tool
│       └── index.ts             # Tool exports
├── storage/
│   ├── DocumentRetriever.ts     # R2 document retrieval
│   └── MemoryRepository.ts      # Hyperdrive user memory storage
└── Logger.ts                    # Logging utilities
```

## Dependencies

- **resend**: Email service provider with webhook support and CC capabilities
- **@langchain/openai**: LangChain integration for structured LLM outputs
- **zod**: Schema validation for structured agent responses

## Cloudflare Bindings

- **R2_BUCKET**: R2 bucket for document storage (policies, prompts)
- **HYPERDRIVE**: PostgreSQL connection for user memory storage
- **ASSETS**: Static assets binding for prompt templates

## Environment Variables (Secrets)

- **RESEND_API_KEY**: Resend API key for sending emails (format: `re_xxxxx`)
- **RESEND_WEBHOOK_SECRET**: Resend webhook secret for signature verification (format: `whsec_xxxxx`)
- **OPENROUTER_API_KEY**: OpenRouter API key for LLM access
- **AUTHORIZED_SENDERS**: Comma-separated list of authorized email domains/addresses (e.g., `forces.gc.ca,test@example.com`)