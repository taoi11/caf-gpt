# CAF-GPT

AI-powered email agent for the Canadian Armed Forces, built with TypeScript and deployed on Cloudflare Workers.

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
- **Full CC Support**: Replies include all CC recipients (up to 50)
- **Document Retrieval**: Access to CAF policies stored in Cloudflare R2
- **Memory Management**: User context stored in Hyperdrive (PostgreSQL)

## Architecture

```
Email → Cloudflare Email Routing → Email Worker → Authorize Sender
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
                                           Reply to sender (no CC/reply-all)
```

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Secrets

```bash
wrangler secret put OPENROUTER_TOKEN
wrangler secret put AUTHORIZED_SENDERS
```

### 3. Deploy

```bash
npm run deploy
```

### 4. Configure Cloudflare Email Routing

1. In Cloudflare Email Routing, route `agent@caf-gpt.com` and `pacenote@caf-gpt.com` to this Worker.
2. Ensure the Worker has the Email event handler enabled (already exported in `src/index.ts`).

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```txt
npm run cf-typegen
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
