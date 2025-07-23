# SvelteKit Routes

> **🤖 AI Agent Navigation** | **Domain**: UI/Server Integration | **Pattern**: Co-located Components

## 🔍 Quick Reference

**Route Pattern**: Each domain gets own subdirectory with full UI + server integration  
**Key Directories**: `pacenote/`, `policy/`, `api/`  
**Integration**: Routes import from `$lib/modules/` for business logic  
**Testing**: Route-level tests in `__tests__/` subdirectories

**Files to Understand**:

- `+layout.svelte` - App-wide layout and theming
- `{domain}/+page.svelte` - Domain UI orchestration
- `{domain}/+page.server.ts` - Server-side logic and form actions
- `{domain}/*.svelte` - Domain-specific UI components

## Purpose

SvelteKit route definitions including UI components, server logic, and API endpoints. Each domain feature has its own subdirectory with co-located components following SvelteKit conventions.

## Directory Structure

```
routes/
├── README.md              # This documentation
├── +layout.svelte         # App-wide layout and theming
├── +page.svelte          # Root landing page
├── __tests__/            # Route-level integration tests
│   └── page.test.ts      # Landing page tests
├── api/                  # API endpoints
│   └── health/           # Health check endpoint
│       └── +server.ts    # Health monitoring
├── pacenote/             # PaceNote domain UI and server logic
│   ├── README.md         # PaceNote route documentation
│   ├── +page.svelte     # Main PaceNote interface
│   ├── +page.server.ts  # Server actions and form handling
│   └── *.svelte         # PaceNote-specific UI components
└── policy/               # PolicyFoo domain UI and server logic
    ├── README.md         # Policy route documentation
    ├── +page.svelte     # Main policy chat interface
    ├── +page.server.ts  # Server actions and message handling
    └── PolicyComponents/ # Policy-specific UI components
```

## 🔄 Integration Points

### With Domain Modules (`$lib/modules/`)

- **Business Logic Import**: Routes import services from corresponding modules
- **Type Safety**: Full TypeScript integration with module type definitions
- **Error Handling**: Unified error patterns from module layer
- **Service Instantiation**: Server actions create and use domain services

### With SvelteKit Framework

- **Server Actions**: Form processing and data handling via SvelteKit actions
- **Progressive Enhancement**: UI works with and without JavaScript
- **Type Safety**: End-to-end TypeScript from modules to UI
- **Routing**: Standard SvelteKit file-based routing patterns

### Between Routes

- **Shared Layout**: Common theming and navigation via `+layout.svelte`
- **Shared Types**: Common UI patterns and type definitions
- **Consistent Patterns**: Uniform server action and component patterns
- **Cross-Route Navigation**: Seamless user experience between domains

## Key Features

### Domain Separation

- **PaceNote Route**: Feedback generation with form-based UI
- **Policy Route**: Chat-based interface with policy set selection
- **API Routes**: System monitoring and external integrations
- **Shared Layout**: Common navigation and theming across domains

### Co-location Architecture

- **UI Components**: Domain-specific components live with their routes
- **Server Logic**: Server actions co-located with UI for maintainability
- **Testing**: Route-level tests adjacent to implementation
- **Documentation**: Route-specific README files for domain details

### Development Patterns

- **Module Integration**: Standard pattern for importing domain services
- **Form Handling**: Consistent server action patterns across routes
- **Error Boundaries**: Graceful error handling and user feedback
- **Progressive Enhancement**: Core functionality without JavaScript dependency

## Development

### Adding New Domain Route

1. Create new subdirectory under `src/routes/`
2. Add `+page.svelte` for main UI orchestration
3. Add `+page.server.ts` for server actions and form handling
4. Create domain-specific components as needed
5. Import business logic from corresponding `$lib/modules/` directory
6. Add route-specific README with domain documentation
7. Add route-level tests in `__tests__/` subdirectory

### Server Action Pattern

- **Form Processing**: Parse and validate form data from UI
- **Service Integration**: Import and instantiate domain services
- **Error Handling**: Return structured errors for UI display
- **Response Format**: Return data in format expected by UI components

### Component Organization

- **Domain Components**: Components specific to a domain live in route subdirectory
- **Shared Components**: Truly shared components go in `$lib/components/`
- **Layout Components**: App-wide UI elements in layout files
- **Testing**: Component tests co-located with implementation
