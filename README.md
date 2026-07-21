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
- **Outlook-Style Reply-All**: Replies to valid Reply-To/From mailboxes and filtered original To/Cc recipients, including external participants
- **Document Retrieval**: Access to CAF policies stored in Cloudflare R2
- **Memory Management**: Per-user context stored in Cloudflare Agents Durable Object state

## Architecture

```text
Email → Cloudflare Email Routing → sender-based Agent resolver
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
                Agents SDK sendEmail through Email Service
                                      ↓
                      Reply-all participants
```

Authorized inbound messages route directly to the `UserAgent` keyed by the normalized SMTP envelope sender; unsigned or stale agent-routing headers do not change that identity. Successful responses use the official Agents SDK `Agent.sendEmail()` helper. Reply-all sends to every valid, unique `Reply-To` mailbox, or RFC `From` when no valid `Reply-To` mailbox remains, then preserves original `To` followed by `Cc` as filtered CC recipients. It excludes `Bcc`, malformed or duplicate addresses, sender and primary identities, and CAF-GPT/self addresses, while retaining valid external participants.

Processing failures before the normal send attempt receive one generic sender-only reply through `Agent.replyToEmail()`. Once `sendEmail()` is invoked, a failure is logged and processing stops without a second fallback message. The application keeps basic operational logs and disables Agents SDK email event emission; it does not maintain a delivery ledger or detailed tracing pipeline.

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Secrets

```bash
wrangler secret put CF_AIG_AUTH
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
