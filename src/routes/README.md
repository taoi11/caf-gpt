# SvelteKit Routes (`src/routes`)

This directory contains all SvelteKit route definitions, including UI, server logic, and API endpoints. Each domain feature has its own subdirectory with co-located components and handlers.

## Structure

- **+layout.svelte**: App-wide layout and theming
- **+page.svelte**: Root landing page
- **pacenote/**: PaceNote domain UI and server logic
- **policy/**: PolicyFoo domain UI and server logic
- **api/**: API endpoints (e.g., health check)
- \***\*tests**/\*\*: Route-level tests

## Principles

- **Co-location**: UI, server, and utility code for each feature live together
- **Domain Separation**: Each major feature (PaceNote, PolicyFoo) has its own directory
- **Minimal API Surface**: Most logic is handled via server actions, not REST endpoints

> For details on each domain, see the README in the corresponding subdirectory.
