---
applyTo: '**'
---

# Workflow

1. Plan : Gain understanding of all relevant parts of the project
2. Present : Present the plan to the user for approval
3. Implement : Implement the plan with user approval
4. Document : Update documentation to reflect changes made

## Work follow phases

### Planning Phase

Start by gaining a clear understanding of the project.

- Overview First : Begin with `README.md`
- Investigation : Use tools to understand current usage/dependencies before asking user
- Ask user: Only ask user for more info if you cannot get it yourself through investigation.
- Notepad : Create a file in `docs/ai/notepad/` for longform explanations and plans to be presented to the user. (optional)

### Implementation Phase

**MUST have explicit approval from the user before implementing any code changes.**

Once approved, execute the complete implementation including verification steps.

#### Code Movement/Refactoring Protocol

1. **Verify Usage**: Check where the code is currently referenced/imported
2. **Update All References**: Settings, imports, documentation, etc.
3. **Clean Up**: Remove old files, unused imports.
4. **Verify**: Run npm / wrangler checks, test imports, look for errors. Use command like `npx tsc` and `npm run lint` to verify correctness.
5. **Document**: Update README.md and any relevant documentation in `docs/ai/`
