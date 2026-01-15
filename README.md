# CAF-GPT

AI-powered email agent for the Canadian Armed Forces, built with TypeScript and deployed on Cloudflare Workers.

## Quick Start

```bash
npm install
npm run dev
npm run deploy
```

## Features

- **Email Processing**: Receives emails via Resend webhooks
- **AI Agent Coordination**: Multi-agent system for policy research and feedback generation
- **Full CC Support**: Replies include all CC recipients (up to 50)
- **Document Retrieval**: Access to CAF policies stored in Cloudflare R2
- **Memory Management**: User context stored in Hyperdrive (PostgreSQL)

## Architecture

```
Email → Resend MX → Webhook → Verify Signature → Authorize Sender
                                                         ↓
                                                 SimpleEmailHandler
                                                         ↓
                                                 AgentCoordinator
                                                         ↓
                                    Prime Foo Agent (orchestrator)
                                    /        |         \
                      LeaveFoo  PaceFoo  DoadFoo  QroFoo (sub-agents)
                                                         ↓
                                                 ResendEmailSender
                                                         ↓
                                                 Reply with CC support
```

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Secrets

```bash
wrangler secret put RESEND_API_KEY
wrangler secret put RESEND_WEBHOOK_SECRET
wrangler secret put OPENROUTER_API_KEY
wrangler secret put AUTHORIZED_SENDERS
```

### 3. Deploy

```bash
npm run deploy
```

### 4. Configure Resend Webhook

1. Go to Resend Dashboard → Webhooks
2. Add webhook URL: `https://caf-gpt-email.<your-subdomain>.workers.dev/webhooks/resend`
3. Subscribe to: `email.received`
4. Copy webhook secret and update via `wrangler secret put RESEND_WEBHOOK_SECRET`

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
