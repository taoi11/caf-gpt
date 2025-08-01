# Testing Strategy

> **🤖 AI Agent Navigation** | **Domain**: Quality Assurance | **Pattern**: Co-located Tests

## 🔍 Quick Reference

**Test Commands**: `npm run test` (all), `npm run test:unit`, `npm run test:integration`  
**Coverage**: `npm run test:coverage` for comprehensive reporting  
**Pattern**: Tests co-located with source files (`*.test.ts`)  
**Environments**: Client-side, server-side, integration testing

## Purpose

This document outlines the testing structure and conventions for CAF GPT.

## Test Structure

Tests are organized into fixtures for test data and mock responses, integration tests for cross-service testing, end-to-end tests for complete workflows, component unit tests, database layer tests, business logic tests, utility function tests, API endpoint tests, and route component tests.

## Directory Structure

```
tests/
├── README.md          # This file
├── fixtures/          # Test data and mock responses
├── integration/       # Cross-service integration tests
└── e2e/              # End-to-end tests

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

## 🔄 Testing Integration Map

### Module Testing

- **PaceNote**: Service unit tests, static import integration tests
- **PolicyFoo**: Handler tests, database integration tests, multi-agent workflow tests
- **Shared Services**: AI Gateway tests, database connection tests

### Route Testing

- **UI Components**: Component rendering and interaction tests
- **Server Actions**: Form validation and service integration tests
- **End-to-End**: Complete user workflows via integration tests

### Test Environment Configuration

- **Client Tests**: Browser environment simulation
- **Server Tests**: Node.js environment with mocked Cloudflare bindings
- **Integration Tests**: Full stack testing with real service connections

## 🔍 Testing Patterns for AI Agents

### When Adding New Features

1. **Unit Tests**: Test business logic in `*.test.ts` files
2. **Integration Tests**: Test service interactions in `tests/integration/`
3. **Component Tests**: Test UI behavior in component directories
4. **Coverage Check**: Ensure `npm run test:coverage` meets standards

### Test Data Management

- **Fixtures**: Reusable test data in `tests/fixtures/`
- **Mocks**: Service mocks for isolated testing
- **Environment**: Test-specific environment variable configuration
