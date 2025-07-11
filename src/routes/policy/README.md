# PolicyFoo Route (`src/routes/policy`)

This directory contains all UI components, server logic, and utilities for the PolicyFoo feature.

## Contents

- **+page.svelte**: Main PolicyFoo chat interface
- **+page.server.ts**: Server-side logic and actions
- **PolicyComponents/**: Reusable UI components (e.g., CitationRenderer, MessageList)

## Principles

- **Co-location**: All UI and server logic for PolicyFoo lives here
- **Type-Safe**: End-to-end TypeScript validation
- **Progressive Enhancement**: Works with and without JavaScript

## Usage Example

Navigate to `/policy` in the app to use the PolicyFoo feature.

> For business logic, see `src/lib/modules/policyFoo`.
