# CAF-GPT Development Guide

Instructions and architecture patterns for LLM developers and AI agents.

## Project Overview

CAF-GPT is a backend-only email agent platform using a multi-agent coordinator pattern, built with TypeScript and deployed on Cloudflare Workers. The system uses Cloudflare Email Routing + Email Workers for inbound email processing, routes emails to specialized AI agents (policy questions, feedback notes), retrieves context from Cloudflare R2 storage, and sends AI-generated replies through the structured Cloudflare Email Service binding.

## Development Commands

**IMPORTANT**: ALWAYS follow this sequence: **Format** (`npm run format`) → **Lint** (`npm run lint`) → **Test** (`npm run test`) → **Compile** (`npm run compile`).

### Command Reference

```bash
npm run format      # Format all files with Biome
npm run lint        # Check for lint issues with Oxlint + anti-slop rules (or `npm run lint:fix`)
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
2. **Boundary and Validation**: The top-level handler fails closed when the `EMAIL` binding is unavailable, then `createUserAgentResolver()` checks authorized senders (forces.gc.ca or specific addresses) and monitored recipients (`agent@caf-gpt.com`, `pacenote@caf-gpt.com`).
3. **Sender Routing**: Every accepted message routes directly to the `UserAgent` keyed by its normalized SMTP envelope sender; inbound agent-routing headers are ignored.
4. **Parsing**: `UserAgent` reads and parses the MIME message with `postal-mime` into `ParsedEmailData`.
5. **Agent Processing**: `UserAgent` routes parsed email context to `AgentCoordinator.processWithPrimeFoo()`.
6. **Reply**: Successful responses use the official Agents SDK `sendEmail()` helper with Outlook-style reply-all recipients and validated threading headers. Pre-send processing errors use one generic sender-only `replyToEmail()` response; failures after `sendEmail()` begins do not trigger a conflicting fallback reply.

### AI SDK Tool-Calling Workflow

**Prime Foo Agent** (`processWithPrimeFoo`) uses **AI SDK tool calling**:

- Prime Foo calls `generateText()` with tools defined inline in `src/agents/AgentCoordinator.ts`.
- `batch_research` accepts leave, DOAD, and QR&O query arrays, then runs the requested sub-agent research calls concurrently.
  - Research sub-agents are `LeaveFooAgent`, `DoadFooAgent`, and `QroFooAgent`.
  - Each domain accepts up to 3 questions per `batch_research` call.
  - `DoadFooAgent` and `QroFooAgent` extend `ToolReadingAgent` and use one bounded `generateText()` tool loop (Luna) to select and read indexed documents. The full `| Id | Title | File |` index is in the prompt (`{doad_table}` / `{qro_index}`), and the model calls `read_file({ file })` with an exact Id from it.
  - Their `read_file` tool allows at most 5 attempts, 3 successful reads, and 2 correctable bad calls, within `stopWhen: [stepCountIs(6), stopOnReadToolError]`. Successful-read slots are reserved before asynchronous loads so concurrent tool execution cannot exceed the cap. A bad call (Id not in the index, or past the read cap) returns an error result to the model so it can correct itself; the 3rd bad call, a 6th attempt, or any tool failure throws and ends the loop at that step.
  - There is no fallback: zero successful reads, an empty answer, rejected tool input, or ending on a tool call at the step limit fails loudly to the error-reply boundary. Typed app errors from a read (for example `StorageNotFoundError`) pass through unchanged; anything else becomes `AgentValidationError`. An index with zero usable rows fails with `StorageValidationError`.
  - Logs carry counts only, through `toLoggableToolReadDiagnostics` in `LogRedaction.ts`: `readReason` (a fixed code from `TOOL_READ_REASONS`), `totalCalls`, `successfulReads`, `badCalls`, `steps`, `indexRows`, `skippedRows`, plus `questionLength` and, for Workers AI binding errors, the numeric `aiUpstreamCode`. Never the question, Ids, titles, bodies, prompts, or model output.
  - Prime Foo passes a tool's own app error through to the error reply (for example a `StorageError` gets the storage template); Workers AI binding errors become `AgentAPIError`; anything else stays `AgentValidationError`.
  - DOAD and QR&O identifiers come from shared `| Id | Title | File |` manifest tables on R2 (`doad/index_v2.md`, `qro/index_v2.md`), parsed by `parseManifestTable` / `parseManifestRows` in `src/agents/utils/ManifestParser.ts`; it rejects absolute paths, dot or empty segments, backslashes, traversal, and non-`.md` files.
- `generate_feedback_note` delegates to `PaceFooAgent.generateNote(rank, context)`.
  - PaceFooAgent loads competencies from R2 (`paceNote/{rank}.md`) and generates feedback.
  - Rank files: `cpl.md`, `mcpl.md`, `sgt.md`, `wo.md`.
- **Circuit breaker**: `stopWhen: [stepCountIs(3), stopOnToolError]` limits the Prime Foo tool loop to 3 model steps and ends it right after the first step with a failed tool call, so a `batch_research` failure is never re-called (each re-call redid every sub-agent) and reaches the error-reply boundary once.
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
- The top-level email handler and `UserAgent.onEmail()` own the inbound SMTP failure boundary. They record basic outcome logs, attempt the permitted rejection or sender-only error reply, and return without allowing processing or reply failures to escape. Once the normal reply attempt begins, failures do not issue an inbound error reply. Scheduled memory work remains retryable and may throw a generic error outside the inbound invocation.

## Storage & Document Retrieval

R2 organization: `${category}/${filename}`

- Categories: `leave/` (policy docs), `doad/` (DOAD policies), `paceNote/` (rank competencies), `qro/` (QR&O chapters and index)
- Access via: `documentRetriever.getDocument("paceNote", "mcpl.md")`
- All documents are UTF-8 encoded markdown files
- Current retrieval is R2 path-based document loading.

## LLM Integration

The codebase uses **Vercel AI SDK** (`ai` + `@ai-sdk/openai`) with the OpenAI Responses provider routed through Cloudflare AI Gateway via the Worker AI binding.

**Key points:**

- Simple text agents use `callLangChain()`; tool-backed agents call AI SDK `generateText()` directly.
- **Prompt templating**: Uses `PromptManager` with `{variable}` syntax for template rendering
- **Tool validation**: Uses Zod input schemas for Prime Foo, memory, and `read_file` tool calls
- **Tool calling**: Prime Foo, Memory Foo, and indexed policy agents use AI SDK `generateText()` tools
- **AI Gateway**: Routes OpenAI Responses requests through the `AI` Worker binding using `workers-ai-provider/gateway`; no Cloudflare REST API token is used
- **Models**: `openai/gpt-5.6-terra` (orchestrator), `openai/gpt-5.6-luna` (specialists); both use temperature 0 and high reasoning effort
- **Streaming is disabled** for CPU efficiency in Cloudflare Workers

## Adding New Agents/Sub-agents

### Simple Sub-Agents (One-Call)

1. Create agent class in `src/agents/sub-agents/your_agent.ts`
2. Implement `research(request: ResearchRequest): Promise<string>` method
3. Add prompt file: `public/prompts/your_agent.md`
4. Add model config: add `yourAgent` to `LLMConfig.models` in `src/config.ts`

### Indexed Tool-Reading Agents (One Call)

For agents that answer from indexed documents (like `DoadFooAgent` and `QroFooAgent`):

1. Create an agent class extending `ToolReadingAgent`.
2. Configure its category, model key, prompt name, `indexVariableName`, and `readLimits`.
3. Implement `getIndexContent()` (or set `indexFile`) and `formatDocumentTag()`.
4. Rely on `parseManifestIndex` / `parseManifestRows` / `parseManifestTable` for the shared `| Id | Title | File |` allowlist; identifiers are validated before any R2 read, and skipped rows are counted.
5. Add one tool-reader prompt such as `public/prompts/doad_foo_tool_reader.md` or `public/prompts/qro_foo_tool_reader.md`. The model chooses files, calls the bounded `read_file` tool, and answers in the same `generateText()` run.
6. Add model config in `src/config.ts`.

The current policy prompt assets are `doad_foo_tool_reader.md`, `qro_foo_tool_reader.md`, and `leave_foo_research.md`. The DOAD and QR&O indexes live on R2, not in `public/prompts/`. There are no separate DOAD or QR&O selector/answer prompts.

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

The `EMAIL` `send_email` binding permits only `agent@caf-gpt.com` and `pacenote@caf-gpt.com` as senders. It intentionally has no configured destination restriction because Outlook-style reply-all can include valid external recipients.

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

- Successful replies use the official Agents SDK `Agent.sendEmail()` helper; generic sender-only error replies use `Agent.replyToEmail()`
- Reply-all uses every valid, unique `Reply-To` mailbox as `To`, falling back to RFC `From` when no valid `Reply-To` mailbox remains
- Reply-all CCs preserve original RFC `To` then `Cc` order, never include `Bcc`, and remove malformed, duplicate, primary, sender, self, and all CAF-GPT-domain addresses; valid external recipients are retained
- The combined structured recipient limit is 50; exceeding it fails the successful response rather than truncating recipients
- Processing failures before `sendEmail()` begins receive one generic plain-text, sender-only `replyToEmail()` response; error-reply failures are logged and swallowed
- Once `sendEmail()` is invoked, any failure is logged and processing stops without a fallback reply
- Threading headers preserve valid `In-Reply-To` and `References`; malformed error-path threading values are omitted
- Reply bodies (HTML and text) are the agent answer plus signature, then Outlook-style quoted history built by `src/email/components/QuotedHistory.ts` from the inbound email itself (its body already carries the earlier chain, so every level carries forward; nothing is rebuilt from storage). Layout: HTML gets a spacer, Outlook's `border-top:solid #E1E1E1 1.0pt` div with bold `From:` (`Name <address>`), `Sent:` (`October 28, 2026 11:29 AM`, no weekday, as Outlook writes it, in the user's learned UTC offset; see the Sent-zone bullet below), `To:` (`; `-joined), `Cc:` (only when present) and `Subject:` lines, then the inbound HTML body through an allowlist sanitizer (scripts, styles, forms, frames, media, comments and the inbound html/head/body wrappers removed; event handlers, non-http(s)/mailto/tel links, non-http(s)/raster-data images dropped; inline CSS kept only per declaration from a property allowlist plus `mso-*`, with values free of escapes, comments and at-rules and no functions except rgb/rgba/hsl/hsla, so url()/image-set()/expression() never survive), or the escaped text body as `MsoNormal` paragraphs when there is no HTML part; text gets a 32-underscore rule, the same header lines, a blank line and the inbound text body. All header values are escaped and folded to one line. No fallbacks: a missing header set, sender or real `Date` header (or a sanitizer failure) logs `Quoted history build failed` with a fixed `quoteFailureReason` (`quote_missing_headers` | `quote_missing_sender` | `quote_missing_date` | `quote_sanitize_failed`) and throws `QuotedHistoryError` (an `EmailCompositionError`) before `sendEmail()`, so the funny composition error reply goes out instead of a quoteless reply and the outcome `reason` is the same fixed code. Generic error replies stay text-only, sender-only and unquoted (they do not use the composer, so a quote failure can never suppress them). The reply-accepted log carries only `quotedHistoryIncluded`, `quotedHtml`, `quoteSourceBytes` and `quoteRemovedNodes` via `toLoggableQuoteDiagnostics` in `LogRedaction.ts`. Threading headers are unaffected. Subjects get exactly one `Re: ` prefix (`normalizeReplySubject()`); `In-Reply-To` = original Message-ID, `References` = original References (or In-Reply-To) + original Message-ID; `Date` is platform-generated by Email Service
- Outlook/Exchange groups conversations by `Thread-Index` (MS-OXOMSG PidTagConversationIndex), not RFC 5322 headers: normal replies to an email that carries a valid `Thread-Index` (folding whitespace ignored; current and legacy Outlook 2007-2019 header FILETIME layouts) get a child index (parent + one 5-byte response level) and `Thread-Topic` (inbound Thread-Topic, else subject without reply prefixes; printable ASCII only) via `src/email/utils/OutlookThreading.ts`. No inbound index means no Thread-* headers. Values are never logged; the reply-accepted log carries only booleans: `outlookThreaded`, plus `threadTopicPresent`, `threadTopicMatches` (Exchange keeps the RFC 2047-decoded inbound Thread-Topic as the conversation topic in every MIME header order, per MS-OXCMAIL 2.2.3.2.6.3: the one-prefix-normalized subject equals it, or a subject Exchange cannot normalize ends with it; case/whitespace-insensitive) and `subjectHasTag` (a `[TAG]` with any Unicode letter, or CAUTION:/EXTERNAL:-style prefix before or after Re:/FW:) from `src/email/utils/ThreadTopicDiagnostics.ts`. These diagnostics never change sending or headers
- Sent-zone learning (`src/agents/utils/SentTimeZone.ts`, parser `src/email/utils/QuotedSentLine.ts`): each normal reply's real UTC send time (captured just before `sendEmail()`) is stored in UserAgent DO SQLite (`cafgpt_reply_sent_times`) keyed by the Message-ID `sendEmail()` returns. On the next inbound email, the topmost quoted header block (the one the user's own Outlook wrote; English `From`/`Sent`/`Date` or French `De`/`Envoyé`/`Date` labels, English or French month/day names, 12- or 24-hour clock, plain-text part first, then the HTML part converted to text) is used only when its From is CAF-GPT (display name or one of our addresses, as `Name`, `Name <addr>`, a bare or `mailto:` address, or the `Name (addr)` text html-to-text writes for a linked sender; nothing looser). Its zone-less Sent: time minus the stored send time of the `In-Reply-To` message (else the single consistent `References` match), rounded to 15 minutes, is the offset (rejected beyond 5 minutes of skew or outside UTC-12..+14). A learned offset formats the new block and is saved per user (`cafgpt_sent_offset`, one row). With no quoted CAF-GPT block the saved offset is used, else America/Edmonton. A quoted CAF-GPT Sent: line that teaches nothing is log-only, not blocking: `Quoted Sent time zone not learned` at error level with a fixed `quoteSentReason` (`quoted_sent_unparseable` | `quoted_sent_no_record` | `quoted_sent_unmatched` | `quoted_sent_ambiguous` | `quoted_sent_storage_failed`), and the reply still goes out with the saved offset or Edmonton. The reply-accepted log adds `quoteSentZoneSource` (`learned` | `saved` | `default`), `quoteSentOffsetMinutes`, `quoteSentLineFound`, `quoteSentReason` (via `toLoggableSentZoneDiagnostics`) and `sentTimeRecorded`. Never store or log quoted text, quoted times, addresses or Message-IDs in logs; only Message-IDs, send times and the offset are stored, pruned at ThreadHistory's 30-day retention by the same daily schedule
- Prior-turn context for Prime Foo is kept in UserAgent DO SQLite (`src/agents/utils/ThreadHistory.ts`, 30-day retention, 20 turns / 20,000 chars): each answered turn is stored as our reply text plus the inbound `formatQuotedContent()` block and appended to the context of the next email in the same thread (matched by References/In-Reply-To, including our outbound Message-ID)

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
