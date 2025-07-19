# Huly MCP Server Test Suite

## Overview

This test suite provides comprehensive unit and integration tests for the Huly MCP Server, achieving approximately 30% code coverage with a focus on core functionality.

## Test Structure

```
__tests__/
├── unit/                    # Unit tests for individual components
│   ├── authentication.test.js    # Connection and auth tests
│   ├── projectManagement.test.js # Project CRUD operations
│   ├── issueCrud.test.js        # Issue management tests
│   └── errorHandling.test.js    # Error handling scenarios
├── integration/            # Integration tests
│   └── mcpServer.test.js       # End-to-end workflow tests
├── mocks/                  # Mock implementations
│   └── hulyClient.mock.js      # Huly client mock
└── setup/                  # Test configuration
    └── testSetup.js           # Common test utilities
```

## Running Tests

```bash
# Run all tests with coverage
npm test

# Run specific test file
npm test -- __tests__/unit/authentication.test.js

# Run tests in watch mode
npm run test:watch

# Run with verbose output
npm test -- --verbose
```

## Test Coverage Areas

### ✅ Implemented Tests

1. **Authentication & Connection (12 tests)**
   - Valid credential connection
   - Connection reuse
   - Default configuration handling
   - Authentication failures
   - WebSocket configuration

2. **Project Management (11 tests)**
   - List all projects
   - Create project with validation
   - Identifier generation and validation
   - Edge cases and error handling

3. **Issue CRUD Operations (16 tests)**
   - Create issues with priorities
   - Update issue fields (title, description, status, priority)
   - Issue identifier parsing
   - Field validation

4. **Error Handling (19 tests)**
   - HulyError class functionality
   - Database error scenarios
   - Network error handling
   - MCP response formatting
   - Error recovery

5. **Integration Tests (7 tests)**
   - Tool registration verification
   - End-to-end project and issue workflows
   - Component and milestone management
   - Search functionality
   - Error scenario handling

### 📊 Current Coverage

- **Statements**: 30.46% (aiming for 80%)
- **Branches**: 25.26% (aiming for 80%)
- **Functions**: 48.38% (aiming for 80%)
- **Lines**: 30.61% (aiming for 80%)

### 🚧 Areas Needing Additional Tests

1. **Subissue Management**
   - Creating subissues
   - Parent-child relationships

2. **GitHub Integration**
   - Repository listing
   - Repository assignment

3. **Advanced Search**
   - Date range filtering
   - Multiple criteria search
   - Pagination

4. **Comment System**
   - Full comment CRUD cycle
   - Markdown formatting

5. **StatusManager**
   - Status conversion logic
   - Custom status handling

## Test Implementation Notes

### Mock Client

The test suite uses a comprehensive mock client (`MockHulyClient`) that simulates the Huly platform API:

- Maintains internal state for projects, issues, components, etc.
- Supports method call tracking for verification
- Handles special operators like `$inc` for updates
- Simulates MarkupBlobRef creation and retrieval

### Key Testing Patterns

1. **Setup/Teardown**: Each test has fresh mock data
2. **Request Validation**: Tests verify proper MCP request format
3. **Response Validation**: Tests check both success and error responses
4. **State Management**: Mock client tracks all operations

## Known Issues

1. **Error Handling Inconsistency**: Some tests expect specific error codes that aren't implemented in the main code
2. **Text Matching**: Some tests fail due to minor differences in expected vs actual text
3. **Async Operations**: Some async operations in the main code aren't properly awaited

## Continuous Integration

To add CI/CD support, create `.github/workflows/test.yml`:

```yaml
name: Test Suite

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run tests
      run: npm test
      
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
```

## Future Improvements

1. **Increase Coverage**: Add tests for untested functions and edge cases
2. **Performance Tests**: Add benchmarks for large dataset operations
3. **Security Tests**: Add tests for input validation and sanitization
4. **Integration Tests**: Add tests with real Huly sandbox environment
5. **Snapshot Testing**: Add snapshot tests for complex response structures

## Contributing

When adding new features:
1. Write tests first (TDD approach)
2. Ensure new code doesn't break existing tests
3. Maintain or improve code coverage
4. Update this documentation