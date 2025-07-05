# AI Instructions

## Workflow

1. Plan : Gain understanding of all relevant parts of the project
2. Present : Present the plan to the user for approval
3. Implement : Implement the plan with user approval

## Development Philosophy

- Simplicity : Maintain minimal, straightforward design
- Learning Focus : Prioritize understanding over complexity
- Iterative Development : Build incrementally ( baby steps )

## User Interaction

- Clarify Instructions : Ask questions to clear up ambiguities in the users requests
- Error Correction : Inform the user of mistakes and suggest fixes
- Contrarian role : Suggest optimal approaches, you are the technical expert, don't be a yes man.
- Explanations : Provide rationale for recommendations

## Code Organization Principles

- **Co-location**: Related functionality should be grouped together
- **Single Responsibility**: Files should have one clear purpose
- **Minimal Files**: Prefer consolidating small, related files over file proliferation
- **Service Layer**: Business logic belongs in services, not handlers or templates
- **Dependency Clarity**: Make dependencies obvious through file organization
- **Go Type Definitions**: Use Go structs and interfaces in service packages for type safety

## Work follow phases

### Planning Phase

Start by gaining a clear understanding of the project.

- Overview First : Begin with `README.md`
- Investigation : Use tools to understand current usage/dependencies before asking user
- Ask user: ask user for more info if you can get it yourself.
- Notepad : Create a file in `.ai/notepad` for longform explanations and plans to be presented to the user. (optional)

### Implementation Phase

**MUST have explicit approval from the user before implementing any code changes.**

#### Code Movement/Refactoring Protocol

1. **Verify Usage**: Check where the code is currently referenced/imported
2. **Update All References**: Settings, imports, documentation, etc.
3. **Clean Up**: Remove old files, unused imports.
4. **Verify**: Run go build / go test / flyctl checks, test imports, look for errors.
5. **Document**: Update README.md and any relevant documentation

#### Architecture

- Use Go standard project structure
- Use Go standard library and html/template builtins
- Place reusable code in internal/
- Keep the README files updated and accurate.
- Optimize for cold starts
- Minimize unnecessary computation

#### Coding Standards

- Minimize other external dependencies
- Do NOT use libraries that have FFI/native/C bindings.
- Follow Fly.io and Go security best practices
- Include proper error handling and logging
- Include comments explaining complex logic

## Efficiency Guidelines

- **Investigate Before Asking**: Use semantic_search, file_search, grep_search to understand the codebase before asking clarifying questions
- **Assume Complete Tasks**: When asked to move/refactor code, assume the user wants a complete job (update references, clean up, verify) things like `go fmt`, `go vet`, `staticcheck`, `go test` etc.
- **Batch Related Changes**: Group related edits together rather than asking for permission for each small step
