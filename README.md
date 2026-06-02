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
- **Reply-All Email Responses**: Sends via Cloudflare Email Service with allowlisted original-CC handling
- **Document Retrieval**: Access to CAF policies stored in Cloudflare R2
- **Memory Management**: User context stored in Hyperdrive (PostgreSQL)

## Architecture

```text
Email → Cloudflare Email Routing → Email Worker → CloudflareEmailWorkerHandler
                                                         ↓
                                                 SimpleEmailHandler
                                                         ↓
                                                 AgentCoordinator
                                                         ↓
                                    Prime Foo Agent (orchestrator)
                                    /        |         \
                      LeaveFoo  PaceFoo  DoadFoo  QroFoo (sub-agents)
                                                         ↓
                                              CloudflareEmailSender
                                                         ↓
                                    Cloudflare Email Service send_email
```

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Secrets

```bash
wrangler secret put AUTHORIZED_SENDERS
wrangler secret put CF_AIG_AUTH
```

### 3. Deploy

```bash
npm run deploy
```

### 4. Configure Cloudflare Email Service

1. In Cloudflare Email Routing, route `agent@caf-gpt.com` and `pacenote@caf-gpt.com` to this Worker.
2. In Cloudflare Email Sending, onboard `caf-gpt.com` and verify the sending DNS records.
3. Ensure the Worker has the Email event handler enabled (already exported in `src/index.ts`).

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
