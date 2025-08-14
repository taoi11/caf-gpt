# Prompt Engineering Guidelines

> Domain: AI Infrastructure | Status: Active | Complexity: Low

## Mission

Document prompt management practices and constraints for the project.

## Context

- Location: `src/lib/modules/*/prompts/`
- Related: `core.md`, module-specific prompt directories

## Policy

- **Human-authored only**: All prompts are written and maintained exclusively by human developers
- **AI read-only access**: LLM code agents may read prompts but must NEVER modify or generate prompt content
- **Versioning**: Prompt changes tracked via Git commits with clear rationale
- **Structure**: 
  - Base templates in `base.md` where applicable
  - Module-specific prompts organized by agent/function
  - Comments for version history and purpose

## Constraints

- Adheres to all [Core Platform Constraints](./core.md#platform-constraints)
- No AI-generated prompt content allowed in production
- Prompt modifications require human review

## Related

- Core: [Core Handbook](./core.md)
