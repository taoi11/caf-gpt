# Testing Strategy

This document outlines the testing structure and conventions for CAF GPT.

## Test Structure

```
tests/
├── fixtures/           # Test data and mock responses
├── integration/        # Cross-service integration tests
├── e2e/               # End-to-end tests
└── README.md          # This file

src/
├── lib/
│   ├── components/__tests__/    # Component unit tests
│   └── server/
│       ├── db/__tests__/        # Database layer tests
│       ├── modules/__tests__/   # Business logic tests
│       └── utils/__tests__/     # Utility function tests
└── routes/
    ├── api/__tests__/          # API endpoint tests
    └── **/*.test.ts           # Route component tests
```

## Test Types

### Unit Tests
- **Location**: `src/**/__tests__/` or `src/**/*.test.ts`
- **Purpose**: Test individual functions, classes, and components in isolation
- **Framework**: Vitest + Testing Library

### Integration Tests
- **Location**: `tests/integration/`
- **Purpose**: Test interactions between services, database operations, API flows
- **Framework**: Vitest

### End-to-End Tests
- **Location**: `tests/e2e/`
- **Purpose**: Test complete user workflows
- **Framework**: Playwright (when added)

## Naming Conventions

- Unit tests: `*.test.ts` or `*.spec.ts`
- Test files should mirror the structure of the source files they test
- Use descriptive test names that explain the behavior being tested

## Test Data

- Mock data and fixtures go in `tests/fixtures/`
- Use factories for generating test data consistently
- Keep sensitive test data in environment variables

## Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Watch mode
npm run test:unit -- --watch

# Coverage
npm run test:unit -- --coverage
```

## Best Practices

1. **Arrange, Act, Assert**: Structure tests clearly
2. **One assertion per test**: Keep tests focused
3. **Mock external dependencies**: Database, APIs, file system
4. **Test edge cases**: Error conditions, boundary values
5. **Use descriptive names**: Tests should read like documentation
