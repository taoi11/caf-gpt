# PaceNote Route (`src/routes/pacenote`)

This directory contains all UI components, server logic, and utilities for the PaceNote feature.

## Contents

- **+page.svelte**: Main PaceNote UI
- **+page.server.ts**: Server-side logic and form actions
- **PaceNoteForm.svelte**: User input form
- **PaceNoteResults.svelte**: Results display
- **PaceNoteTips.svelte**: Usage tips and guidance
- **ui.ts**: Route-specific utilities (e.g., scroll, clipboard)
- **config.server.ts**: Route-level configuration
- **form.server.ts**: Form validation and helpers

## Principles

- **Co-location**: All UI and server logic for PaceNote lives here
- **Type-Safe**: End-to-end TypeScript validation
- **Progressive Enhancement**: Works with and without JavaScript

## Usage Example

Navigate to `/pacenote` in the app to use the PaceNote feature.

> For business logic, see `src/lib/modules/paceNote`.
