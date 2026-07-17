# CAF-GPT Development Guide

Instructions and architecture patterns for LLM developers and AI agents.

## Project Overview

CAF-GPT is a backend-only email agent platform using a multi-agent coordinator pattern, built with TypeScript and deployed on Cloudflare Workers. The system uses Cloudflare Email Routing + Email Workers for inbound email processing, routes emails to specialized AI agents (policy questions, feedback notes), retrieves context from Cloudflare R2 storage, and sends AI-generated replies through the structured Cloudflare Email Service binding.

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
2. **Boundary and Validation**: The top-level handler fails closed when `EMAIL_SECRET` or the `EMAIL` binding is unavailable, then `createUserAgentResolver()` checks authorized senders (forces.gc.ca or specific addresses) and monitored recipients (`agent@caf-gpt.com`, `pacenote@caf-gpt.com`).
3. **Delivery Reservation**: `UserAgent` reads raw bytes once and reserves the normalized-envelope-plus-raw SHA-256 fingerprint before parsing, with a header-based fallback when raw reading fails.
4. **Parsing**: `UserAgent` parses the retained MIME bytes with `postal-mime` into `ParsedEmailData`.
5. **Agent Processing**: `UserAgent` routes parsed email context to `AgentCoordinator.processWithPrimeFoo()`.
6. **Reply**: Successful responses use `signAgentHeaders()` and the structured `EMAIL` binding directly, with principal-bound signed routing headers, validated threading headers, authorization-filtered reply-all recipients, and the durable at-most-once ledger. Deterministic pre-send errors use exactly one ledger-guarded sender-only inbound `AgentEmail.reply()`; ambiguous structured-send failures never send a conflicting fallback reply.

### AI SDK Tool-Calling Workflow

**Prime Foo Agent** (`processWithPrimeFoo`) uses **AI SDK tool calling**:

- Prime Foo calls `generateText()` with tools defined inline in `src/agents/AgentCoordinator.ts`.
- `batch_research` accepts leave, DOAD, and QR&O query arrays, then runs the requested sub-agent research calls concurrently.
  - Research sub-agents are `LeaveFooAgent`, `DoadFooAgent`, and `QroFooAgent`.
  - Each domain accepts up to 3 questions per `batch_research` call.
  - `DoadFooAgent` and `QroFooAgent` extend `ToolReadingAgent` and use one bounded `generateText()` tool loop to select and read indexed documents.
  - Their `read_file` tool allows at most 5 attempts, 3 successful reads, and 2 correctable bad calls. Successful-read slots are reserved before asynchronous loads so concurrent tool execution cannot exceed the cap.
  - DOAD identifiers come from the DOAD Markdown table. QR&O paths come from actual Markdown list/table entries in `qro/index.md`; its allowlist parser rejects absolute paths, dot or empty segments, backslashes, and traversal.
- `generate_feedback_note` delegates to `PaceFooAgent.generateNote(rank, context)`.
  - PaceFooAgent loads competencies from R2 (`paceNote/{rank}.md`) and generates feedback.
  - Rank files: `cpl.md`, `mcpl.md`, `sgt.md`, `wo.md`.
- **Circuit breaker**: `stopWhen: stepCountIs(3)` limits the Prime Foo tool loop to 3 model steps.
- `MemoryFooAgent` runs from `UserAgent` around the main response path to update user memory after successful replies.

### Tool Input Validation with Zod

AI SDK tool inputs are validated with Zod schemas:

- Prime Foo defines its tool input schemas inline in `AgentCoordinator`.
- `ToolReadingAgent` defines the `read_file` input schema inline and validates file values against the domain index allowlist before loading R2.
- `MemoryFooAgent` uses `MemoryUpdateToolInputSchema` and `MemoryUnchangedToolInputSchema` from `src/schemas.ts` with a required `generateText()` tool call.
- AI SDK validates tool inputs before execution; agents additionally validate recognized tool names and domain-specific values.

### Strict Failure Mode (No Degraded State Within Logic Modules)

Business logic modules must be designed to either succeed completely or fail cleanly. Individual modules should not silently produce partial, unverified, or degraded results.

- If workflow encounters an unrecoverable error (e.g., API failure, missing context), the operation must be halted.
- The system must catch the failure and respond to the user with a standardized error email using the pre-defined error templates.
- A module should never fallback to providing partial, unverified, or degraded responses within that module's own contract.
- Outer orchestration can intentionally skip optional modules when that behavior is explicit, tested, and documented. For example, memory retrieval may fail without preventing the core email response path if the response itself remains complete and verified.
- The top-level email handler and `UserAgent.onEmail()` own the inbound SMTP failure boundary. They log content-free metadata, attempt the permitted rejection or sender-only error reply, and return without allowing processing or reply failures to escape. Once a structured send begins, failures remain terminal/unknown and do not issue an inbound error reply. Scheduled memory work remains retryable and may throw a generic content-free error outside the inbound invocation.

## Storage & Document Retrieval

R2 organization: `${category}/${filename}`

- Categories: `leave/` (policy docs), `doad/` (DOAD policies), `paceNote/` (rank competencies), `qro/` (QR&O chapters and index)
- Access via: `documentRetriever.getDocument("paceNote", "mcpl.md")`
- All documents are UTF-8 encoded markdown files
- Current retrieval is R2 path-based document loading. Planned semantic retrieval work belongs in `TODO.md` until a pgvector/Neon migration is designed.

## LLM Integration

The codebase uses **Vercel AI SDK** (`ai` + `ai-gateway-provider`) with Cloudflare AI Gateway for all LLM interactions.

**Key points:**

- Simple text agents use `callLangChain()`; tool-backed agents call AI SDK `generateText()` directly.
- **Prompt templating**: Uses `PromptManager` with `{variable}` syntax for template rendering
- **Tool validation**: Uses Zod input schemas for Prime Foo, memory, and `read_file` tool calls
- **Tool calling**: Prime Foo, Memory Foo, and indexed policy agents use AI SDK `generateText()` tools
- **AI Gateway**: Routes through Cloudflare AI Gateway via `ai-gateway-provider` with the unified provider — current code requires the `CF_AIG_AUTH` secret
- **Models**: `@cf/moonshotai/kimi-k2.7-code` (orchestrator), `google-ai-studio/gemini-3.1-flash-lite-preview` (specialists)
- **Streaming is disabled** for CPU efficiency in Cloudflare Workers

## Adding New Agents/Sub-agents

### Simple Sub-Agents (One-Call)

1. Create agent class in `src/agents/sub-agents/your_agent.ts`
2. Implement `research(request: ResearchRequest): Promise<string>` method
3. Add prompt file: `public/prompts/your_agent.md`
4. Add model config: add `yourAgent` to `LLMConfig.models` in `src/config.ts`

### Indexed Tool-Reading Agents (One Call)

For agents that select and read documents from an index (like `DoadFooAgent` and `QroFooAgent`):

1. Create an agent class extending `ToolReadingAgent`.
2. Configure its category, model key, prompt name, index variable, and read limits.
3. Implement `getIndexContent()`, `getAllowedFiles()`, `getFilePath()`, and `formatDocumentTag()`.
4. Parse only explicit manifest entries into the allowlist and validate identifiers or safe relative paths before any R2 read.
5. Add one tool-reader prompt such as `public/prompts/doad_foo_tool_reader.md` or `public/prompts/qro_foo_tool_reader.md`. The model chooses files, calls the bounded `read_file` tool, and answers in the same `generateText()` run.
6. Add model config in `src/config.ts`.

The current policy prompt assets are `DOAD_Table.md`, `doad_foo_tool_reader.md`, `qro_foo_tool_reader.md`, and `leave_foo_research.md`. There are no separate DOAD or QR&O selector/answer prompts.

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

### Cloudflare Email Binding

The `EMAIL` `send_email` binding permits only `agent@caf-gpt.com` and `pacenote@caf-gpt.com` as senders. It intentionally has no configured destination restriction because successful replies can include multiple authorized recipients. `EMAIL_SECRET` signs the Agents SDK routing headers.

## Email Processing Details

### Threading & Concurrency

- `UserAgent` handles each email as an independent Cloudflare Worker event
- No background polling - emails are processed via Cloudflare Email Worker events
- Each email request is processed synchronously without concurrency concerns
- Failed processing results are logged but don't leave emails "unread" in the traditional sense

### Email Threading Headers

`UserAgent` builds proper threading headers:

- `In-Reply-To`: original message-id
- `References`: all parent message-ids
- Ensures replies appear in same thread in email clients

### Email Replies

- Successful replies generate canonical routing headers with the supported `agents/email` `signAgentHeaders()` export and call `env.EMAIL.send()` directly; do not use `Agent.sendEmail()` because its SDK observability includes address and subject fields
- RFC `From` and any single `Reply-To` must equal the normalized SMTP envelope sender; delegated header identity requires a future explicit server-side ACL
- Reply-all CCs preserve original RFC `To` then `Cc` order, never include `Bcc`, and remove malformed, unauthorized, duplicate, sender, self, and all CAF-GPT-domain addresses
- The combined structured recipient limit is 50; exceeding it fails the successful response rather than truncating recipients
- Every delivery reserves its normalized-envelope-plus-raw-byte SHA-256 fingerprint before parsing, validation, and recipient resolution; raw-read failures reserve a stable header-based fallback, and the ledger remains bounded to 128 rows/30 days
- Deterministic pre-send error responses remain exactly one ledger-guarded plain-text, sender-only `AgentEmail.reply()` to the authorized envelope sender; error-reply failures are terminal, logged without content, and swallowed
- Threading headers preserve valid `In-Reply-To` and `References`; malformed error-path threading values are omitted
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
