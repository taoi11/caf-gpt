# CAF-GPT Development Guide

Instructions and architecture patterns for LLM developers and AI agents.

## Project Overview

CAF-GPT is a backend-only email agent platform using a multi-agent coordinator pattern, built with TypeScript and deployed on Cloudflare Workers. The system receives email through Resend Inboxes (an `inbox.email.received` webhook to the Worker), routes emails to specialized AI agents (policy questions, feedback notes), retrieves context from Cloudflare R2 storage, and sends AI-generated replies through Resend's thread reply endpoint.

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

Emails arrive through **Resend Inboxes** (one inbox per monitored address: `agent@caf-gpt.com`, `pacenote@caf-gpt.com`):

1. **Inbound Trigger**: Resend POSTs `inbox.email.received` to `POST /webhooks/resend` (`fetch()` in `src/index.ts`; there is no `email()` handler or `send_email` binding).
2. **Boundary and Validation**: `src/email/resend/ResendWebhook.ts` verifies the Svix signature (`svix-id`/`svix-timestamp`/`svix-signature`, HMAC-SHA256 over `id.timestamp.body` with the base64 part of `RESEND_WEBHOOK_SECRET`, 5-minute tolerance) and parses the event with zod. The route fails loudly (500) when `RESEND_API_KEY` or `RESEND_WEBHOOK_SECRET` is missing, answers 400/401/413 for unsigned, forged, stale, malformed or oversized requests, and answers 200 (no work) for other event types, outbound mail and unauthorized senders (forces.gc.ca or specific addresses). The body limit is enforced while streaming. The monitored-inbox check is not done on the To header (mail that only Cc'd the inbox must still be handled); `processResendEmail` checks the receiving inbox's own address instead.
3. **Sender Routing and Idempotency**: Every accepted message routes to the `UserAgent` keyed by the normalized webhook sender. `UserAgent.receiveResendEmail()` claims the Resend `email_id` in DO SQLite (`cafgpt_resend_inbound`, `src/agents/utils/InboundLedger.ts`) so Resend's retries are acknowledged as `duplicate`, then schedules `processResendEmail` (no SDK retry) and the webhook returns 200. A scheduling failure releases the claim and returns 500 so Resend retries.
4. **Fetch and Parsing**: `processResendEmail` reads the inbox address (`GET /inboxes/{id}`), the received email (`GET /emails/receiving/{id}`: SPF/DKIM/DMARC results and the signed raw download URL), requires DMARC or DKIM `pass`, downloads the raw MIME and parses it with `postal-mime` into `ParsedEmailData` (`src/email/resend/InboundEmail.ts`).
5. **Agent Processing**: `UserAgent` routes parsed email context to `AgentCoordinator.processWithPrimeFoo()`.
6. **Reply**: Successful responses use `POST /inboxes/{inbox}/threads/{thread}/emails/{email}/reply` (`src/email/resend/ResendClient.ts`) with an `Idempotency-Key` of `caf-gpt-reply/{email_id}`, `reply_all: false`, explicit Cc, and only `Thread-Index`/`Thread-Topic` custom headers (Resend sets To, In-Reply-To and References itself). Pre-send processing errors use one generic sender-only reply (`caf-gpt-error/{email_id}`); failures after the reply request begins do not trigger a conflicting fallback reply.

### AI SDK Tool-Calling Workflow

**Prime Foo Agent** (`processWithPrimeFoo`) uses **AI SDK tool calling**:

- Prime Foo calls `generateText()` with tools defined inline in `src/agents/AgentCoordinator.ts`.
- `batch_research` accepts leave, DOAD, and QR&O query arrays, then runs the requested sub-agent research calls concurrently.
  - Research sub-agents are `LeaveFooAgent`, `DoadFooAgent`, and `QroFooAgent`.
  - Each domain accepts up to 3 questions per `batch_research` call.
  - `DoadFooAgent` and `QroFooAgent` extend `ToolReadingAgent`: Clef-flash shortlists allowlisted index ids, DocumentRetriever prefetches those docs (max 3), then one `generateText()` answer call uses only the prefetched content (no `read_file` selection loop).
  - The shortlist is two-stage, because one choice over the whole 10–15 KB manifest never reached the 0.6 confidence threshold. Stage 1 (`group_pick`, one request) picks one group: the QR&O volume folder (first id segment, e.g. `vol-1-administration`, `qroVolumeGroup`) or the DAOD thousand series (`5019-0` → 5000 series, `doadSeriesGroup`); each group option lists its documents' titles. Stage 2 ranks documents in that group only (`pick_1..3`), so a shortlist is at most 1 + 3 = 4 Clef-flash calls. The same `CLEF_SHORTLIST_CONFIDENCE_THRESHOLD` (0.6) applies at every rank of both stages.
  - Shortlist validation failures (malformed / invented or already-chosen / too many options / empty-failed) throw to the error-email boundary. A low-confidence group, a low-confidence stage-1 `none`, or no confident document in the chosen group (a stage-2 `none` included) is `clef_empty_shortlist`; only a confident stage-1 `none` (no group applies) may answer with zero prefetched docs. There is no fallback: a failed shortlist always ends in a visible error reply.
  - Clef answers each question in a request independently, so stage 2 asks one rank per `AI.run` request and drops already-chosen documents from the next rank's options. Each request sends the manifest (or the chosen group) once, as option descriptions; Clef accepts at most 255 options per choice question (`CLEF_CHOICE_MAX_OPTIONS`), and both stages (group count, and every group's size, plus `none`) are checked before anything is sent.
  - The failure log carries only the fixed `shortlistReason` code, the content-free shortlist diagnostics, and, for Workers AI binding errors, `errorName` plus the numeric `aiUpstreamCode` (never the error message, picks, choice keys, titles, question text, or model output). Diagnostics pass through `toLoggableShortlistDiagnostics` in `LogRedaction.ts`, which keeps only `shortlistStage` (`group` | `document`, the last stage reached) and, per stage (`shortlistGroup` / `shortlistDocument` objects), `optionCount`, `rankReached`, `topIsNone`, `topConfidence` (rank-1 confidence) and `topMargin` (rank-1 gap between the two highest probabilities), as finite numbers and booleans only; the success performance log carries the same fields.
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
- `ToolReadingAgent` shortlists via Clef-flash against the domain index allowlist, then prefetches validated File paths from R2 before the answer call.
- `MemoryFooAgent` uses `MemoryUpdateToolInputSchema` and `MemoryUnchangedToolInputSchema` from `src/schemas.ts` with a required `generateText()` tool call.
- AI SDK validates tool inputs before execution; agents additionally validate recognized tool names and domain-specific values.

### Strict Failure Mode (No Degraded State Within Logic Modules)

Business logic modules must be designed to either succeed completely or fail cleanly. Individual modules should not silently produce partial, unverified, or degraded results.

- If workflow encounters an unrecoverable error (e.g., API failure, missing context), the operation must be halted.
- The system must catch the failure and respond to the user with a standardized error email using the pre-defined error templates.
- A module should never fallback to providing partial, unverified, or degraded responses within that module's own contract.
- Outer orchestration can intentionally skip optional modules when that behavior is explicit, tested, and documented. For example, memory retrieval may fail without preventing the core email response path if the response itself remains complete and verified.
- The webhook route and `UserAgent.processResendEmail()` own the inbound failure boundary. The route returns non-2xx only for verification, configuration and hand-off failures (so Resend retries); processing runs in a scheduled task that records basic outcome logs, attempts the permitted sender-only error reply, and returns without allowing processing or reply failures to escape. Once the normal reply attempt begins, failures do not issue an inbound error reply. Scheduled memory work remains retryable and may throw a generic error outside the inbound invocation.

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

### Indexed Shortlist-Prefetch Agents (One Call)

For agents that answer from indexed documents (like `DoadFooAgent` and `QroFooAgent`):

1. Create an agent class extending `ToolReadingAgent`.
2. Configure its category, model key, prompt name, `documentsVariableName`, and `maxPrefetchDocuments`.
3. Implement `getIndexContent()` and `formatDocumentTag()`.
4. Rely on `parseManifestRows` / `parseManifestTable` for the shared `| Id | Title | File |` allowlist; identifiers are validated before any R2 read.
5. Provide a `groupOf(row)` stage-1 grouping (`{ key, label }`) derived from the manifest ids.
6. Clef-flash shortlists allowlisted ids (`shortlistManifestFiles`: one group request, then one rank per request inside it); `DocumentRetriever` prefetches those docs; the specialist answers once from `{prefetched_documents}` with no `read_file` selection loop.
7. Add one answer prompt such as `public/prompts/doad_foo_tool_reader.md` or `public/prompts/qro_foo_tool_reader.md` that cites only prefetched documents.
8. Add model config in `src/config.ts`.

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
- Test the mail path with `tests/workers/resendHarness.ts` (fetch spy for the Resend API, raw MIME fixtures) and the webhook route with `tests/mocks/resendWebhook.ts` (signed events); never make live Resend calls
- Test validators (see `tests/unit/EmailValidator.test.ts`)
- Circuit breaker tests verify max LLM call limits
- LLM mocks use `vi.hoisted()` pattern for proper ES module mocking

### Build & Type Checking

Build and type-checking are handled by TypeScript compiler during `wrangler deploy --minify`.

### Resend Configuration

`RESEND_API_KEY` and `RESEND_WEBHOOK_SECRET` are Worker secrets (local: `.dev.vars`, see `.dev.vars.example`); never commit them. Resend Inboxes fixes the reply To (Reply-To, else From) and the From (the inbox address), so the recipient policy only contributes Cc. Outlook-style reply-all can include valid external recipients.

## Email Processing Details

### Threading & Concurrency

- `UserAgent` handles each email as an independent scheduled task started by the webhook
- No background polling - emails are processed via Resend webhook deliveries
- Resend retries deliveries; the `email_id` ledger (30-day retention) makes repeated deliveries no-ops and the reply `Idempotency-Key` (kept 24 h by Resend) prevents duplicate sends
- Failed processing results are logged but don't leave emails "unread" in the traditional sense

### Email Threading Headers

`UserAgent` builds proper threading headers:

- `In-Reply-To` and `References` are set by Resend's thread reply endpoint (they cannot be passed as custom headers)
- `Thread-Index`/`Thread-Topic` are added by us for Outlook/Exchange
- The sent Message-ID is read back with `GET /emails/{id}` and linked into ThreadHistory; when Resend has not assigned it yet, the send time is kept as pending and resolved on the next inbound email

### Email Replies

- Successful replies and generic sender-only error replies both use Resend's thread reply endpoint
- Resend sends To the `Reply-To` (else From); policy To mailboxes Resend would not reach move to Cc, and a warning (counts only) is logged when they differ
- Reply-all CCs preserve original RFC `To` then `Cc` order, never include `Bcc`, and remove malformed, duplicate, primary, sender, self, and all CAF-GPT-domain addresses; valid external recipients are retained
- The combined structured recipient limit is 50; exceeding it fails the successful response rather than truncating recipients
- Processing failures before the reply request begins receive one generic plain-text, sender-only response (only to an authenticated, authorized sender whose Reply-To, if any, is itself); error-reply failures are logged and swallowed
- Once the reply request is sent, any failure is logged and processing stops without a fallback reply
- Malformed or control-character threading values are omitted from custom headers
- Reply bodies (HTML and text) are the agent answer plus signature, then Outlook-style quoted history built by `src/email/components/QuotedHistory.ts` from the inbound email itself (its body already carries the earlier chain, so every level carries forward; nothing is rebuilt from storage). Layout: HTML gets a spacer, Outlook's `border-top:solid #E1E1E1 1.0pt` div with bold `From:` (`Name <address>`), `Sent:` (`October 28, 2026 11:29 AM`, no weekday, as Outlook writes it, in the user's learned UTC offset; see the Sent-zone bullet below), `To:` (`; `-joined), `Cc:` (only when present) and `Subject:` lines, then the inbound HTML body through an allowlist sanitizer (scripts, styles, forms, frames, media, comments and the inbound html/head/body wrappers removed; event handlers, non-http(s)/mailto/tel links, non-http(s)/raster-data images dropped; inline CSS kept only per declaration from a property allowlist plus `mso-*`, with values free of escapes, comments and at-rules and no functions except rgb/rgba/hsl/hsla, so url()/image-set()/expression() never survive), or the escaped text body as `MsoNormal` paragraphs when there is no HTML part; text gets a 32-underscore rule, the same header lines, a blank line and the inbound text body. All header values are escaped and folded to one line. No fallbacks: a missing header set, sender or real `Date` header (or a sanitizer failure) logs `Quoted history build failed` with a fixed `quoteFailureReason` (`quote_missing_headers` | `quote_missing_sender` | `quote_missing_date` | `quote_sanitize_failed`) and throws `QuotedHistoryError` (an `EmailCompositionError`) before the reply request, so the funny composition error reply goes out instead of a quoteless reply and the outcome `reason` is the same fixed code. Generic error replies stay text-only, sender-only and unquoted (they do not use the composer, so a quote failure can never suppress them). The reply-accepted log carries only `quotedHistoryIncluded`, `quotedHtml`, `quoteSourceBytes` and `quoteRemovedNodes` via `toLoggableQuoteDiagnostics` in `LogRedaction.ts`. Threading headers are unaffected. Subjects get exactly one `Re: ` prefix (`normalizeReplySubject()`); `In-Reply-To` = original Message-ID, `References` = original References (or In-Reply-To) + original Message-ID; `Date`, `In-Reply-To` and `References` are generated by Resend
- Outlook/Exchange groups conversations by `Thread-Index` (MS-OXOMSG PidTagConversationIndex), not RFC 5322 headers: normal replies to an email that carries a valid `Thread-Index` (folding whitespace ignored; current and legacy Outlook 2007-2019 header FILETIME layouts) get a child index (parent + one 5-byte response level) and `Thread-Topic` (inbound Thread-Topic, else subject without reply prefixes; printable ASCII only) via `src/email/utils/OutlookThreading.ts`. No inbound index means no Thread-* headers. Values are never logged; the reply-accepted log carries only booleans: `outlookThreaded`, plus `threadTopicPresent`, `threadTopicMatches` (Exchange keeps the RFC 2047-decoded inbound Thread-Topic as the conversation topic in every MIME header order, per MS-OXCMAIL 2.2.3.2.6.3: the one-prefix-normalized subject equals it, or a subject Exchange cannot normalize ends with it; case/whitespace-insensitive) and `subjectHasTag` (a `[TAG]` with any Unicode letter, or CAUTION:/EXTERNAL:-style prefix before or after Re:/FW:) from `src/email/utils/ThreadTopicDiagnostics.ts`. These diagnostics never change sending or headers
- Sent-zone learning (`src/agents/utils/SentTimeZone.ts`, parser `src/email/utils/QuotedSentLine.ts`): each normal reply's real UTC send time (captured just before the reply request) is stored in UserAgent DO SQLite (`cafgpt_reply_sent_times`) keyed by the Message-ID read back from `GET /emails/{id}` (or in `cafgpt_pending_sent_times` keyed by the Resend email id until that Message-ID is available). On the next inbound email, the topmost quoted header block (the one the user's own Outlook wrote; English `From`/`Sent`/`Date` or French `De`/`Envoyé`/`Date` labels, English or French month/day names, 12- or 24-hour clock, plain-text part first, then the HTML part converted to text) is used only when its From is CAF-GPT (display name or one of our addresses, as `Name`, `Name <addr>`, a bare or `mailto:` address, or the `Name (addr)` text html-to-text writes for a linked sender; nothing looser). Its zone-less Sent: time minus the stored send time of the `In-Reply-To` message (else the single consistent `References` match), rounded to 15 minutes, is the offset (rejected beyond 5 minutes of skew or outside UTC-12..+14). A learned offset formats the new block and is saved per user (`cafgpt_sent_offset`, one row). With no quoted CAF-GPT block the saved offset is used, else America/Edmonton. A quoted CAF-GPT Sent: line that teaches nothing is log-only, not blocking: `Quoted Sent time zone not learned` at error level with a fixed `quoteSentReason` (`quoted_sent_unparseable` | `quoted_sent_no_record` | `quoted_sent_unmatched` | `quoted_sent_ambiguous` | `quoted_sent_storage_failed`), and the reply still goes out with the saved offset or Edmonton. The reply-accepted log adds `quoteSentZoneSource` (`learned` | `saved` | `default`), `quoteSentOffsetMinutes`, `quoteSentLineFound`, `quoteSentReason` (via `toLoggableSentZoneDiagnostics`) and `sentTimeRecorded`. Never store or log quoted text, quoted times, addresses or Message-IDs in logs; only Message-IDs, send times and the offset are stored, pruned at ThreadHistory's 30-day retention by the same daily schedule
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
