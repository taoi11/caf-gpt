# Email AI Agent System

## Project Structure

```
src/
├── index.ts                    # Main entry point with HTTP + email worker handlers
├── types.ts                    # TypeScript interfaces
├── email/
│   ├── SimpleEmailHandler.ts   # Email processing and orchestration
│   ├── CloudflareEmailSender.ts # Email sending via Cloudflare Email Workers reply API
│   ├── CloudflareEmailWorkerHandler.ts # Email worker ingress parsing + authorization
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

- **postal-mime**: MIME parser for Cloudflare Email Worker inbound messages
- **@langchain/openai**: LangChain integration for structured LLM outputs
- **zod**: Schema validation for structured agent responses

## Cloudflare Bindings

- **R2_BUCKET**: R2 bucket for document storage (policies, prompts)
- **HYPERDRIVE**: PostgreSQL connection for user memory storage
- **ASSETS**: Static assets binding for prompt templates

## Environment Variables (Secrets)

- **OPENROUTER_TOKEN**: OpenRouter API key for LLM access
- **AUTHORIZED_SENDERS**: Comma-separated list of authorized email domains/addresses (e.g., `forces.gc.ca,test@example.com`)
