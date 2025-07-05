# CAF GPT Maintenance Plan: Module Independence & Better Code Organization

## Current Analysis

### Existing Structure Problems
1. **Shared Dependencies**: Both `pacenote_service.go` and `policy_service.go` depend on:
   - `OpenRouterClient` (shared AI client)
   - `TigrisClient` (shared storage client)
   - Common `Usage` struct and types
   - Handlers depend on both services simultaneously

2. **Tight Coupling in Main**: 
   - Single initialization in `main.go`
   - Handlers require both services to be passed
   - Shared configuration object

3. **Mixed Concerns**:
   - OpenRouter client is generic but used by both modules
   - Storage client handles both pacenote and policy files
   - Common HTTP patterns but different business logic

### Current Shared Code
```go
// main.go - Everything initialized together
tigrisClient, openRouterClient, paceNoteService, policyService

// handlers/pages.go - Depends on both services
func NewHandlers(cfg, paceNoteService, policyService, templates)

// services/ - Shared openrouter.go client
```

## Proposed New Structure: Independent Modules

### Goal: Make Each Module Self-Contained
- Each module has its own client implementations
- No shared dependencies between pacenote and policy
- Each module can be deployed independently
- Code duplication is acceptable for maintenance benefits

### New Directory Structure

```
caf-gpt/
├── cmd/
│   └── cafgpt/
│       └── main.go                  # Minimal initialization
├── internal/
│   ├── common/                      # ONLY truly shared utilities
│   │   ├── config/
│   │   │   └── config.go           # Environment loading only
│   │   └── http/
│   │       └── middleware.go       # HTTP middleware only
│   │
│   ├── pacenote/                   # Completely independent module
│   │   ├── handlers/
│   │   │   ├── pages.go           # pacenote-specific page handlers
│   │   │   └── partials.go        # pacenote-specific HTMX handlers
│   │   ├── services/
│   │   │   ├── openrouter.go      # pacenote-specific OpenRouter client
│   │   │   ├── storage.go         # pacenote-specific Tigris client
│   │   │   └── pacenote.go        # core pacenote business logic
│   │   ├── types/
│   │   │   └── types.go           # pacenote-specific types
│   │   └── prompts/               # embedded prompts (go:embed)
│   │       └── base.md
│   │
│   ├── policy/                     # Completely independent module
│   │   ├── handlers/
│   │   │   ├── pages.go           # policy-specific page handlers
│   │   │   └── partials.go        # policy-specific HTMX handlers
│   │   ├── services/
│   │   │   ├── openrouter.go      # policy-specific OpenRouter client
│   │   │   ├── storage.go         # policy-specific Tigris client
│   │   │   └── policy.go          # core policy business logic
│   │   ├── types/
│   │   │   └── types.go           # policy-specific types
│   │   └── prompts/               # embedded prompts (go:embed)
│   │       ├── doad/
│   │       │   ├── finder.md
│   │       │   ├── main.md
│   │       │   └── DOAD-list-table.md
│   │       └── leave/
│   │           └── main.md
│   │
│   └── home/                       # Homepage module
│       ├── handlers/
│       │   └── home.go            # homepage and health handlers
│       └── templates/             # embedded templates (go:embed)
│           └── index.html
│
├── templates/                      # Top-level templates
│   ├── base/
│   │   └── layout.html            # shared layout only
│   ├── pacenote/
│   │   ├── page.html              # pacenote page template
│   │   └── partials/
│   │       └── results.html
│   └── policy/
│       ├── page.html              # policy page template
│       └── partials/
│           └── response.html
├── static/                        # Static assets (unchanged)
│   ├── css/app.css
│   └── js/htmx.min.js
├── go.mod
└── fly.toml
```

## Implementation Strategy

### Phase 1: Create Independent Modules

1. **Duplicate OpenRouter Client**
   - Copy `services/openrouter.go` to `pacenote/services/openrouter.go`
   - Copy `services/openrouter.go` to `policy/services/openrouter.go`
   - Allow each module to evolve its client independently
   - Different modules may need different models/parameters

2. **Duplicate Storage Client**
   - Copy `storage/tigris.go` to `pacenote/services/storage.go`
   - Copy `storage/tigris.go` to `policy/services/storage.go`
   - Each module handles only its own file types and paths

3. **Split Service Types**
   - Create `pacenote/types/types.go` with pacenote-specific types
   - Create `policy/types/types.go` with policy-specific types
   - No shared types between modules

### Phase 2: Embed Prompts and Templates

1. **Embed Prompts in Each Module**
   ```go
   // pacenote/services/pacenote.go
   //go:embed prompts/*.md
   var promptFS embed.FS
   
   // policy/services/policy.go  
   //go:embed prompts/**/*.md
   var promptFS embed.FS
   ```

2. **Module-Specific Templates**
   ```go
   // pacenote/handlers/pages.go
   //go:embed ../../templates/pacenote/*.html
   var templateFS embed.FS
   
   // policy/handlers/pages.go
   //go:embed ../../templates/policy/*.html  
   var templateFS embed.FS
   ```

### Phase 3: Independent Initialization

1. **Modular Main Function**
   ```go
   // main.go - Register modules independently
   func main() {
       mux := http.NewServeMux()
       
       // Register home module
       home.RegisterRoutes(mux, cfg)
       
       // Register pacenote module  
       pacenote.RegisterRoutes(mux, cfg)
       
       // Register policy module
       policy.RegisterRoutes(mux, cfg)
       
       http.ListenAndServe(cfg.Port, mux)
   }
   ```

2. **Module Registration Pattern**
   ```go
   // pacenote/handlers/routes.go
   func RegisterRoutes(mux *http.ServeMux, cfg *config.Config) {
       service := services.NewPaceNoteService(cfg)
       handlers := NewHandlers(service)
       
       mux.HandleFunc("/pacenote", handlers.PageHandler)
       mux.HandleFunc("/pacenote/generate", handlers.GenerateHandler)
   }
   ```

### Phase 4: Configuration Independence

1. **Module-Specific Config**
   ```go
   // pacenote/services/config.go
   type Config struct {
       OpenRouterAPIKey string
       Model           string
       TigrisConfig    TigrisConfig
   }
   
   func LoadConfig() *Config {
       return &Config{
           OpenRouterAPIKey: os.Getenv("OPENROUTER_API_KEY"),
           Model:           os.Getenv("PACENOTE_MODEL"),
           // ... tigris config
       }
   }
   ```

## Benefits of This Approach

### 1. **True Independence**
- Each module can be modified without affecting the other
- Different teams can work on different modules
- Modules can have different deployment cycles

### 2. **Clearer Boundaries** 
- No shared business logic between modules
- Each module owns its complete stack
- Easier to reason about module behavior

### 3. **Better Testing**
- Each module can be tested in isolation
- Mock dependencies are simpler (no shared interfaces)
- Integration tests are clearer

### 4. **Deployment Flexibility**
- Could split into separate services later
- Feature flags per module
- Independent scaling if needed

### 5. **Maintenance Benefits**
- Bug fixes in one module don't affect others
- Updates to AI models can be module-specific
- Prompt changes are module-scoped

## Trade-offs We Accept

### 1. **Code Duplication**
- **Acceptable**: OpenRouter client logic duplicated
- **Acceptable**: Tigris storage client duplicated  
- **Acceptable**: Common HTTP patterns duplicated
- **Reasoning**: Independence is more valuable than DRY

### 2. **Slightly Larger Binary**
- **Impact**: Minimal (Go compiles efficiently)
- **Benefit**: Self-contained modules worth the cost

### 3. **More Files**
- **Reality**: Better organization outweighs file count
- **Benefit**: Clear module boundaries

## Implementation Steps

1. **Create Module Directories** ✅ (Plan only)
2. **Copy and Modify OpenRouter Clients** 
3. **Copy and Modify Storage Clients**
4. **Split Service Types** 
5. **Create Module-Specific Handlers**
6. **Embed Prompts in Each Module**
7. **Update Template Structure**
8. **Refactor Main to Register Modules**
9. **Update Tests**
10. **Verify Independence**

## Success Criteria

- [ ] Each module can be built independently
- [ ] No import dependencies between pacenote and policy modules
- [ ] Each module has its own complete client stack
- [ ] Prompts and templates are embedded per module  
- [ ] Main.go is minimal and only does module registration
- [ ] Tests verify module independence
- [ ] Documentation reflects new structure

## Front-End Considerations (Future)

This structure will make front-end separation easier:
- Each module could have its own UI bundle
- HTMX interactions remain module-scoped
- Templates are already module-specific
- Static assets can be module-specific if needed

The current front-end will continue to work unchanged during this refactor.
