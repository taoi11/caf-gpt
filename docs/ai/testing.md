# Testing

Mission: Centralize testing strategy, commands, and patterns.

## Commands

```bash
npm test              # all
npm run test:unit     # unit
npm run test:integration
npm run test:unit -- --watch
npm run test:unit -- --coverage
```

## Structure

- Co-located unit tests: src/\*_/_.test.ts
- Integration: tests/integration/
- Fixtures: tests/fixtures/

## Patterns

- Arrange, Act, Assert
- Mock external deps (DB, network)
- Test edge cases and error paths

## Areas

- Modules: service logic and workflows
- Routes: server actions and UI components
- Core: ai-gateway, db service
