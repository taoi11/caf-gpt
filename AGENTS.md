# CAF-GPT Development Guide

Instructions and architecture patterns for LLM developers and AI agents.

## Project Overview

CAF-GPT is a backend-only email agent platform using a multi-agent coordinator pattern, built with TypeScript and deployed on Cloudflare Workers. The system uses Cloudflare Email Routing + Email Workers for inbound email processing, routes emails to specialized AI agents (policy questions, feedback notes), retrieves context from Cloudflare R2 storage, and sends AI-generated inbound replies via the Email Workers `reply()` API.

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
5. **Reply**: `UserAgent` sends AI-generated sender-only responses via the original inbound `AgentEmail.reply()` envelope, preserving threading headers and signed Agents SDK routing headers.

### AI SDK Tool-Calling Workflow

**Prime Foo Agent** (`processWithPrimeFoo`) uses **AI SDK tool calling**:

- Prime Foo calls `generateText()` with tools defined inline in `src/agents/AgentCoordinator.ts`.
- `batch_research` accepts leave, DOAD, and QR&O query arrays, then runs the requested sub-agent research calls concurrently.
  - Research sub-agents are `LeaveFooAgent`, `DoadFooAgent`, and `QroFooAgent`.
  - Each domain accepts up to 3 questions per `batch_research` call.
- `generate_feedback_note` delegates to `PaceFooAgent.generateNote(rank, context)`.
  - PaceFooAgent loads competencies from R2 (`paceNote/{rank}.md`) and generates feedback.
  - Rank files: `cpl.md`, `mcpl.md`, `sgt.md`, `wo.md`.
- **Circuit breaker**: `stopWhen: stepCountIs(3)` limits the Prime Foo tool loop to 3 model steps.
- `MemoryFooAgent` runs from `SimpleEmailHandler` around the main response path to retrieve and update user memory.

### Structured Output with Zod

Selector and memory agents use `callLangChainStructured()` with Zod schema validation:

- Define response schema using Zod (see `src/schemas.ts`)
- LLM returns JSON matching schema via AI SDK's `generateObject()` with structured output
- AI SDK automatically validates and parses response using the Zod schema
- Zod throws `ValidationError` if response doesn't match schema
- AI SDK's built-in error handling catches API failures and timeout errors

### Strict Failure Mode (No Degraded State Within Logic Modules)

Business logic modules must be designed to either succeed completely or fail cleanly. Individual modules should not silently produce partial, unverified, or degraded results.

- If workflow encounters an unrecoverable error (e.g., API failure, missing context), the operation must be halted.
- The system must catch the failure and respond to the user with a standardized error email using the pre-defined error templates.
- A module should never fallback to providing partial, unverified, or degraded responses within that module's own contract.
- Outer orchestration can intentionally skip optional modules when that behavior is explicit, tested, and documented. For example, memory retrieval may fail without preventing the core email response path if the response itself remains complete and verified.

## Storage & Document Retrieval

R2 organization: `${category}/${filename}`

- Categories: `leave/` (policy docs), `paceNote/` (rank competencies), `qro/` (QR&O chapters)
- Access via: `documentRetriever.getDocument("paceNote", "mcpl.md")`
- All documents are UTF-8 encoded markdown files
- Current retrieval is R2 path-based document loading. Planned semantic retrieval work belongs in `TODO.md` until a pgvector/Neon migration is designed.

## LLM Integration

The codebase uses **Vercel AI SDK** (`ai` + `ai-gateway-provider`) with Cloudflare AI Gateway for all LLM interactions.

**Key points:**

- Agents use `callLangChain()` and `callLangChainStructured()` methods in `src/agents/utils/BaseAgent.ts`
- **Prompt templating**: Uses `PromptManager` with `{variable}` syntax for template rendering
- **Structured output**: Uses `generateObject()` with Zod schemas (defined in `src/schemas.ts`) for automatic JSON validation
- **Tool calling**: Prime Foo uses AI SDK `generateText()` with tools in `src/agents/AgentCoordinator.ts`
- **AI Gateway**: Routes through Cloudflare AI Gateway via `ai-gateway-provider` with the unified provider — current code requires the `CF_AIG_AUTH` secret
- **Models**: `@cf/moonshotai/kimi-k2.7-code` (orchestrator), `google-ai-studio/gemini-3.1-flash-lite-preview` (specialists)
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

After creating any new tool-backed agent class, instantiate it in `AgentCoordinator.create()` and wire it into the relevant AI SDK tool:

```typescript
const yourAgent = new YourAgent(env, config);

tools: {
  your_tool: tool({
    inputSchema: YourSchema,
    execute: async (input) => yourAgent.research(input),
  }),
}
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

- Inbound replies are sent via `AgentEmail.reply()` using the original Email Worker message so arbitrary inbound senders do not need to be verified Cloudflare Email Service destinations
- Normal replies and error responses are sender-only; do not use `env.EMAIL.send()` for direct inbound replies unless every destination is known to be verified/allowed
- Threading headers preserved: `In-Reply-To`, `References`
- Quoted content formatted using `EmailComposer.formatQuotedContent()`

## Important Gotchas

- **Prompts use caching**: `PromptManager` caches loaded prompts (LRU, max 32) - use its methods, don't read files directly
- **Signature appending**: `AgentCoordinator.processWithPrimeFoo()` appends the CAF-GPT signature to Prime Foo replies (includes GitHub link)

## TypeScript Comment Standards

This repository follows a strict commenting standard for **ALL** TypeScript files.

### File-Level Comments (Required)

Every TypeScript module must have a JSDoc comment block at the **very top** that:

1. Includes the file path (relative to repo root)
2. States the responsibility/purpose of the code in the file
3. Lists all top-level functions or classes and brief descriptions

```typescript
/**
 * src/agents/utils/BaseAgent.ts
 *
 * Base agent with Cloudflare Workers AI integration via AI SDK
 *
 * Top-level declarations:
 * - BaseAgent: Base agent with AI SDK integration and template-based prompts
 * - createModel: Creates AI model via AI Gateway provider
 * - callLangChain: Backward-compatible wrapper for plain text model calls
 * - callLangChainStructured: Backward-compatible wrapper for structured model calls
 */
```

### Function/Class Comments (Required)

Every top-level function or class must have JSDoc comments immediately above their definition that:

1. Provide a brief description of purpose and behavior
2. List parameters when applicable
3. Are single-line for simple methods.

```typescript
// Call LLM using cached AI SDK model and rendered prompt variables
protected async callLangChain(params: LLMCallParams): Promise<string> {
```

### Inline Comments (Minimal)

Inline comments are used sparingly within functions. **Only add them when:**

1. Documenting a specific lesson learned
2. Explaining a non-obvious solution to a specific problem
3. Noting a workaround for a known issue
