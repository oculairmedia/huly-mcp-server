# Integration Tests

This directory contains integration tests for the Huly MCP Server. These tests interact with a real Huly instance to verify end-to-end functionality.

## Prerequisites

1. **Test Huly Instance**: You need access to a Huly instance for testing
2. **Test Credentials**: Valid credentials for the test instance
3. **Test Workspace**: A dedicated workspace for integration testing

## Setup

1. Copy the test environment template:
   ```bash
   cp .env.test.example .env.test
   ```

2. Edit `.env.test` with your test credentials:
   ```env
   HULY_URL=https://your-test-instance.com
   HULY_EMAIL=test@example.com
   HULY_PASSWORD=your-password
   HULY_WORKSPACE=test-workspace
   ```

3. **Important**: Use a dedicated test workspace to avoid data conflicts

## Running Tests

### Run all integration tests:
```bash
npm run test:integration
```

### Run specific test suites:
```bash
# MCP server tests only
npm run test:integration:server

# Bulk operations tests only
npm run test:integration:bulk
```

### Run with verbose output:
```bash
NODE_OPTIONS='--experimental-vm-modules' jest --config jest.config.integration.mjs --verbose
```

## Test Structure

### `setup.js`
- Environment setup and validation
- Test data generators
- Resource tracking and cleanup
- Common test utilities

### `mcp-server.test.js`
- End-to-end MCP server testing
- Tool discovery and validation
- Basic CRUD operations
- Error handling

### `bulk-operations.test.js`
- Bulk create/update/delete operations
- Performance testing
- Concurrent operation handling
- Data integrity verification

## Resource Cleanup

The tests implement automatic cleanup:

1. **Resource Tracking**: All created resources are tracked
2. **Cleanup on Completion**: Resources are deleted after tests
3. **Force Cleanup**: Uses force deletion to ensure cleanup

Example:
```javascript
trackResource('projects', projectId);
trackResource('issues', issueId);
// Automatically cleaned up in afterAll()
```

## Writing New Tests

### 1. Use Test Data Generators
```javascript
const projectId = generateTestProjectIdentifier(); // TEST123
const issueData = generateTestIssueData({
  title: 'Custom title'
});
```

### 2. Track Created Resources
```javascript
const result = await createIssue(...);
trackResource('issues', result.identifier);
```

### 3. Use Assertion Helpers
```javascript
expectToBeIssue(issue);
expectToBeProject(project);
```

### 4. Handle Async Operations
```javascript
await waitForCondition(
  async () => issue.status === 'Done',
  5000 // timeout
);
```

## Best Practices

1. **Isolation**: Each test should be independent
2. **Unique Data**: Use timestamps in test data to avoid conflicts
3. **Cleanup**: Always track resources for cleanup
4. **Timeouts**: Set appropriate timeouts for long operations
5. **Error Messages**: Include context in assertions

## Troubleshooting

### Tests Failing with Authentication Errors
- Verify `.env.test` credentials are correct
- Check if the test instance is accessible
- Ensure the workspace exists

### Cleanup Failures
- Resources may remain if tests crash
- Manually clean up test projects starting with "TEST"
- Check logs for cleanup warnings

### Timeout Errors
- Default timeout is 60 seconds
- Increase for slow operations:
  ```javascript
  jest.setTimeout(120000); // 2 minutes
  ```

### Connection Issues
- Verify network connectivity
- Check if Huly instance is running
- Review proxy settings if applicable

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `HULY_URL` | Huly instance URL | Yes |
| `HULY_EMAIL` | Test user email | Yes |
| `HULY_PASSWORD` | Test user password | Yes |
| `HULY_WORKSPACE` | Test workspace name | Yes |
| `LOG_LEVEL` | Logging level (default: error) | No |
| `NODE_ENV` | Set to 'test' | No |

## CI/CD Integration

For CI environments:

1. Set environment variables in CI config
2. Use a dedicated CI test instance
3. Consider parallel test execution limits
4. Monitor for resource leaks

Example GitHub Actions:
```yaml
- name: Run Integration Tests
  env:
    HULY_URL: ${{ secrets.TEST_HULY_URL }}
    HULY_EMAIL: ${{ secrets.TEST_HULY_EMAIL }}
    HULY_PASSWORD: ${{ secrets.TEST_HULY_PASSWORD }}
    HULY_WORKSPACE: ci-test-workspace
  run: npm run test:integration
```