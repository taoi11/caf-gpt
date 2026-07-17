# CAF-GPT

AI-powered email agent for the Canadian Armed Forces, crafted with TypeScript and deployed on Cloudflare Workers.

> **Disclaimer:** CAF-GPT is an **unofficial** hobby project. It is **not** an official Government of Canada / DND / CAF application and is **not** affiliated with or endorsed by the Government of Canada, DND, or the CAF.

## Quick Start

```bash
npm install
npm run dev
npm run deploy
```

## Features

- **Email Processing**: Receives emails via Cloudflare Email Workers
- **AI Agent Coordination**: Multi-agent system for policy research and feedback generation
- **Safe Reply-All**: Sends structured, signed replies to an authorized primary recipient and filtered authorized To/Cc recipients
- **Document Retrieval**: Access to CAF policies stored in Cloudflare R2
- **Memory Management**: Per-user context stored in Cloudflare Agents Durable Object state

## Architecture

```text
Email → Cloudflare Email Routing → routeAgentEmail
                                      ↓
                         UserAgent Durable Object
                         (per normalized sender email)
                                      ↓
                              AgentCoordinator
                                      ↓
                         Prime Foo Agent (orchestrator)
                         /        |         \
           LeaveFoo  PaceFoo  DoadFoo  QroFoo (sub-agents)
                                      ↓
              Signed structured reply through Email Service
                                      ↓
                     Authorized To/Cc recipients
```

Successful responses call the structured Email Service binding directly after generating canonical signed routing headers with the supported Agents SDK email export. The SDK `Agent.sendEmail()` helper is intentionally bypassed so CAF-GPT does not emit its outbound `email:send` observability event containing address and subject fields. The SMTP envelope sender, RFC `From`, optional `Reply-To`, signed route, and per-user Durable Object are bound to the same normalized principal. Errors before a structured send attempt remain one plain-text, sender-only reply through the original inbound Email Worker event. `Bcc` is never propagated.

Inbound delivery uses a bounded 128-entry, 30-day durable fingerprint ledger. Raw bytes are read once and combined with normalized envelope identity into an opaque SHA-256 fingerprint, which is reserved before MIME parsing, validation, or recipient resolution. If raw reading fails, a stable SHA-256 fallback uses normalized envelope identity, raw size, and available header entries without logging or storing those inputs. A delivery is moved to `send_started` before Email Service is called; any exception after that point remains terminal/unknown and never triggers a conflicting error reply. This is intentionally at-most-once: a retry after an ambiguous send or isolate failure can lose a reply, but cannot duplicate any successful or sender-only error reply while its ledger entry is retained.

Application-owned `Logger` output excludes mailbox addresses, subjects, message/header content, model identifiers and output, secrets, and exception text. Separately, the Agents SDK's pre-existing inbound `email:receive` observability may include `from`, `to`, and `subject` when platform traces are enabled; this limitation is outside the application logger and is not expanded by the direct outbound binding path.

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Secrets

```bash
wrangler secret put CF_AIG_AUTH
wrangler secret put EMAIL_SECRET
```

Authorized senders are deliberately code-reviewed in `src/config.ts`: the `forces.gc.ca` domain and the exact mailbox `luffy@luffy.email`. Deployment variables cannot broaden this policy.

### 3. Deploy

```bash
npm run deploy
```

### 4. Configure Cloudflare Email Routing

1. In Cloudflare Email Routing, route `agent@caf-gpt.com` and `pacenote@caf-gpt.com` to this Worker.
2. Ensure the Worker has the Email event handler enabled (already exported in `src/index.ts`).
3. Enable Email Sending for `caf-gpt.com`; the committed `EMAIL` binding allows only `agent@caf-gpt.com` and `pacenote@caf-gpt.com` as sender addresses and intentionally has no destination restriction.

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```txt
npm run cf-typegen
```

Commit `worker-configuration.d.ts` to git so editor tooling and CI use the same bindings. In CI, use:

```txt
npm run types:check
```

## Development Setup

### Enable Pre-commit Hook

```bash
git config core.hooksPath .githooks
```

This enables a pre-commit hook that blocks commits if linting fails.

### Linting & Formatting

```bash
npm run lint        # Check for issues
npm run lint:fix    # Auto-fix issues
npm run format      # Format all files
```
