# CAF-GPT Development Guide

Instrauctions and architecture patterns LLM developers AI agents.

## Project Overview

CAF-GPT is a backend-only email agent platform using a multi-agent coordinator pattern, built with TypeScript and deployed on Cloudflare Workers. The system uses Cloudflare Email Routing + Email Workers for inbound email processing, routes emails to specialized AI agents (policy questions, feedback notes), retrieves context from Cloudflare R2 storage, and sends AI-generated replies via the Cloudflare Email Workers reply API (sender-only replies).

## Development Commands

**IMPORTANT**: ALWAYS follow this sequence: **Format** (`npm run format`) → **Lint** (`npm run lint`) → **Test** (`npm run test`) → **Compile** (`npm run compile`).

### Command Reference

```bash
npm run format      # Format all files with Biome
npm run lint        # Check for lint issues (or npm run lint:fix to auto-fix)
npm run test        # Run Vitest test suite (minimal output)
npm run test:verbose # Run tests (full console output)
npm run test:watch   # Run tests in watch mode
npm run compile     # Run TypeScript type checking
npm run dev         # Run local dev server with wrangler
npm run deploy      # Deploy to production (--minify enabled)
wrangler types --env-interface CloudflareBindings  # Generate TypeScript types
```

### Development Philosophy

- **"Leroy Jenkins - We push to main"**: This is a hobby app, debugging directly on main branch is expected
- No staging/dev environment complexity - deploy to production and fix issues there

## Agent Architecture Patterns

### Email Routing & Flow

Emails are processed through **Cloudflare Email Workers**:

1. **Inbound Trigger**: Worker `email()` handler in `src/index.ts`.
2. **Validation**: `CloudflareEmailWorkerHandler` checks authorized senders (forces.gc.ca or specific addresses) and monitored recipients (`agent@caf-gpt.com`, `pacenote@caf-gpt.com`).
3. **Parsing**: MIME content parsed with `postal-mime` into `ParsedEmailData`.
4. **Agent Processing**: `SimpleEmailHandler.processEmail()` routes to `AgentCoordinator.processWithPrimeFoo()`.
5. **Reply**: `CloudflareEmailSender` sends AI-generated response via `message.reply()` (sender-only).

### Iterative Agent Workflow

**Prime Foo Agent** (`processWithPrimeFoo`) uses **iterative JSON response loops**:

- LLM returns structured JSON: `{"type": "reply"}`, `{"type": "research"}`, `{"type": "feedback_note"}`, or `{"type": "no_response"}`
- If `research`: delegate to sub-agent → send results back → LLM replies again
  - Sub-agents registered in `AgentCoordinator` constructor (`LeaveFooAgent`, `PaceFooAgent`, `DoadFooAgent`, `QroFooAgent`)
  - Example: `{"type": "research", "research": {"sub_agent": "leave_foo", "queries": [{"query": "..."}]}}`
- If `feedback_note`: delegate to `PaceFooAgent` → send generated note back → LLM wraps in reply
  - Format: `{"type": "feedback_note", "feedbackNote": {"rank": "cpl", "context": "event context"}}`
  - PaceFooAgent loads competencies from R2 (`paceNote/{rank}.md`) and generates feedback
  - Rank files: `cpl.md`, `mcpl.md`, `sgt.md`, `wo.md`
- **Circuit breaker**: max 3 sub-agent calls per email to prevent infinite loops

### Structured Output with Zod

All agents use `callLangChainStructured()` with Zod schema validation:

- Define response schema using Zod (see `src/schemas.ts`)
- LLM returns JSON matching schema via AI SDK's `generateObject()` with structured output
- AI SDK automatically validates and parses response using the Zod schema
- Zod throws `ValidationError` if response doesn't match schema
- AI SDK's built-in error handling catches API failures and timeout errors

### Strict Failure Mode (No Degraded State)

Business logic must be designed to either succeed completely or fail cleanly. The application explicitly does not support a "degraded" operational mode.

- If workflow encounters an unrecoverable error (e.g., API failure, missing context), the operation must be halted.
- The system must catch the failure and respond to the user with a standardized error email using the pre-defined error templates.
- App should never fallback to providing partial, unverified, or degraded responses.

## Storage & Document Retrieval

R2 organization: `${category}/${filename}`

- Categories: `leave/` (policy docs), `paceNote/` (rank competencies), `qro/` (QR&O chapters)
- Access via: `documentRetriever.getDocument("paceNote", "mcpl.md")`
- All documents are UTF-8 encoded markdown files

## LLM Integration

The codebase uses **Vercel AI SDK** (`ai` + `ai-gateway-provider`) with Cloudflare AI Gateway for all LLM interactions.

**Key points:**

- All agents use `callLangChain()` and `callLangChainStructured()` methods in `BaseAgent.ts`
- **Prompt templating**: Uses `PromptManager` with `{variable}` syntax for template rendering
- **Structured output**: Uses `generateObject()` with Zod schemas (defined in `src/schemas.ts`) for automatic JSON validation
- **AI Gateway**: Routes through Cloudflare AI Gateway via `ai-gateway-provider` with the unified provider — requires `CF_AIG_TOKEN` secret
- **Models**: `workers-ai/@cf/moonshotai/kimi-k2.5` (orchestrator), `workers-ai/@cf/zai-org/glm-4.7-flash` (specialists)
- **Streaming is disabled** for CPU efficiency in Cloudflare Workers

## Adding New Agents/Sub-agents

### Simple Sub-Agents (One-Call)

1. Create agent class in `src/agents/sub-agents/your_agent.ts`
2. Implement `research(request: ResearchRequest): Promise<string>` method
3. Add prompt file: `public/prompts/your_agent.md`
4. Add model config: add `yourAgent` to `LLMConfig.models` in `src/config.ts`

### Two-Call Pattern Agents (Selector → Answer)

For agents that need to select from an index before answering (like `DoadFooAgent`, `QroFooAgent`):

1. Create agent class extending `BaseAgent`
2. Implement `research()` method that:
   - Calls `_selectFiles()` - loads index from R2, uses selector prompt to identify relevant documents
   - Calls `_loadFiles()` - loads selected documents from R2
   - Calls `_answerQuery()` - uses answer prompt with loaded content to generate response
3. Create two prompt files:
   - `your_agent_selector.md` - selects relevant files, returns `<files>path1,path2</files>`
   - `your_agent_answer.md` - answers query using loaded documents
4. Add model config in `src/config.ts`

### Registering Agents

After creating any new agent class, register it in the `AgentCoordinator` constructor:

```typescript
this.yourAgent = new YourAgent(env);
this.subAgents.set("your_foo", this.yourAgent);
```

## Code Quality Standards

### Testing Conventions

- Use Vitest for testing with mocking
- Test agent logic with mock LLM responses (see `tests/unit/PaceFooAgent.test.ts`)
- Test email components with mocks (see `tests/integration/EmailHandler.test.ts`)
- Test validators (see `tests/unit/EmailValidator.test.ts`)
- Circuit breaker tests verify max LLM call limits
- LLM mocks use `vi.hoisted()` pattern for proper ES module mocking

### Build & Type Checking

Build and type-checking are handled by TypeScript compiler during `wrangler deploy --minify`.

## Email Processing Details

### Threading & Concurrency

- `SimpleEmailHandler` handles each email as an independent Cloudflare Worker event
- No background polling - emails are processed via Cloudflare Email Worker events
- Each email request is processed synchronously without concurrency concerns
- Failed processing results are logged but don't leave emails "unread" in the traditional sense

### Email Threading Headers

`EmailThreadManager` builds proper threading headers:

- `In-Reply-To`: original message-id
- `References`: all parent message-ids
- Ensures replies appear in same thread in email clients

### Email Replies

- Replies sent via `CloudflareEmailSender` using Cloudflare Email Workers reply API
- **Sender-only replies**: current implementation does not CC/reply-all
- Threading headers preserved: `In-Reply-To`, `References`
- Quoted content formatted using `EmailComposer.formatQuotedContent()`

## Important Gotchas

- **Prompts use caching**: `PromptManager` caches loaded prompts (LRU, max 32) - use its methods, don't read files directly
- **Signature appending**: `AgentCoordinator.SIGNATURE` is appended to all Prime Foo agent replies (includes GitHub link)

## TypeScript Comment Standards

This repository follows a strict commenting standard for **ALL** TypeScript files.

### File-Level Comments (Required)

Every TypeScript module must have a JSDoc comment block at the **very top** that:

1. Includes the file path (relative to repo root)
2. States the responsibility/purpose of the code in the file
3. Lists all top-level functions or classes and brief descriptions

```typescript
/**
 * src/agents/BaseAgent.ts
 *
 * Base agent with LangChain LLM integration using ChatPromptTemplate
 *
 * Top-level declarations:
 * - BaseAgent: Base agent with LangChain integration and template-based prompts
 * - callLangChain: Calls LLM using cached ChatPromptTemplate with variables
 * - callLangChainStructured: Calls LLM with structured output using Zod schema
 */
```

### Function/Class Comments (Required)

Every top-level function or class must have JSDoc comments immediately above their definition that:

1. Provide a brief description of purpose and behavior
2. List parameters when applicable
3. Are single-line for simple methods.

```typescript
// Call LLM using cached ChatPromptTemplate with variables
protected async callLangChain(params: LLMCallParams): Promise<string> {
```

### Inline Comments (Minimal)

Inline comments are used sparingly within functions. **Only add them when:**

1. Documenting a specific lesson learned
2. Explaining a non-obvious solution to a specific problem
3. Noting a workaround for a known issue
