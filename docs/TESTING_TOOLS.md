# Testing Guidelines for Tool Development

This guide provides comprehensive instructions for writing tests when developing new tools in the Huly MCP Server's modular architecture.

## Table of Contents

1. [Overview](#overview)
2. [Test Structure](#test-structure)
3. [Testing Tool Definitions](#testing-tool-definitions)
4. [Testing Handler Functions](#testing-handler-functions)
5. [Testing Validation Functions](#testing-validation-functions)
6. [Mocking Strategies](#mocking-strategies)
7. [Best Practices](#best-practices)
8. [Example Test Template](#example-test-template)

## Overview

Every tool in the modular architecture should have comprehensive test coverage including:

- **Definition Tests**: Verify tool metadata and schema
- **Handler Tests**: Test the tool's execution logic
- **Validation Tests**: Ensure input validation works correctly

### Test Coverage Requirements

- Minimum 80% code coverage for all tools
- 100% coverage for validation functions
- All error paths must be tested
- Edge cases and boundary conditions covered

## Test Structure

Tests for each tool should be placed in a `__tests__` directory within the tool's category:

```
src/tools/
├── projects/
│   ├── __tests__/
│   │   ├── createProject.test.js
│   │   └── listProjects.test.js
│   ├── createProject.js
│   └── listProjects.js
```

## Testing Tool Definitions

Tool definitions should be tested to ensure they conform to the MCP schema requirements:

```javascript
describe('Tool Definition', () => {
  it('should export a valid tool definition', () => {
    expect(definition).toBeDefined();
    expect(definition.name).toBe('huly_create_project');
    expect(definition.description).toBeDefined();
    expect(definition.inputSchema).toBeDefined();
    expect(definition.inputSchema.type).toBe('object');
    expect(definition.inputSchema.properties).toBeDefined();
    expect(definition.inputSchema.required).toBeInstanceOf(Array);
  });

  it('should have correct input schema', () => {
    const { properties, required } = definition.inputSchema;
    
    // Test each property
    expect(properties.name).toEqual({
      type: 'string',
      description: 'Project name'
    });
    
    // Test required fields
    expect(required).toContain('name');
  });
});
```

## Testing Handler Functions

Handler functions should be tested with various inputs and scenarios:

```javascript
describe('Handler Function', () => {
  let mockContext;

  beforeEach(() => {
    mockContext = {
      client: {},
      services: {
        projectService: {
          createProject: jest.fn()
        }
      },
      logger: {
        debug: jest.fn(),
        error: jest.fn()
      }
    };
  });

  it('should create project successfully', async () => {
    // Mock successful response
    mockContext.services.projectService.createProject.mockResolvedValue({
      content: [{ type: 'text', text: 'Created project: TEST' }]
    });

    const result = await handler({ name: 'Test Project' }, mockContext);

    expect(mockContext.services.projectService.createProject).toHaveBeenCalledWith(
      mockContext.client,
      'Test Project',
      undefined,
      undefined
    );
    expect(result).toBeDefined();
  });

  it('should handle service errors', async () => {
    // Mock error
    mockContext.services.projectService.createProject.mockRejectedValue(
      new Error('Service unavailable')
    );

    const result = await handler({ name: 'Test Project' }, mockContext);

    expect(result.content[0].text).toContain('Error');
    expect(mockContext.logger.error).toHaveBeenCalled();
  });
});
```

## Testing Validation Functions

Validation functions require thorough testing of all validation rules:

```javascript
describe('Validation Function', () => {
  it('should return null for valid input', () => {
    const validInput = {
      project_identifier: 'TEST',
      title: 'Valid Title',
      priority: 'high'
    };

    expect(validate(validInput)).toBeNull();
  });

  it('should validate required fields', () => {
    const errors = validate({});
    
    expect(errors).toBeDefined();
    expect(errors.project_identifier).toContain('required');
    expect(errors.title).toContain('required');
  });

  it('should validate field formats', () => {
    const errors = validate({
      project_identifier: 'TEST',
      title: 'Valid',
      target_date: 'not-a-date'
    });

    expect(errors.target_date).toContain('ISO 8601');
  });

  it('should validate enum values', () => {
    const errors = validate({
      project_identifier: 'TEST',
      title: 'Valid',
      priority: 'invalid-priority'
    });

    expect(errors.priority).toContain('must be one of');
  });
});
```

## Mocking Strategies

### Mocking the Huly Client

```javascript
const mockClient = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  createDoc: jest.fn(),
  updateDoc: jest.fn(),
  getHierarchy: jest.fn().mockReturnValue({
    isDerived: jest.fn().mockReturnValue(true),
    getClass: jest.fn().mockReturnValue({ label: 'TestClass' })
  })
};
```

### Mocking Services

```javascript
const mockServices = {
  projectService: {
    getAllProjects: jest.fn().mockResolvedValue([]),
    createProject: jest.fn(),
    // ... other methods
  },
  issueService: {
    listIssues: jest.fn().mockResolvedValue([]),
    createIssue: jest.fn(),
    // ... other methods
  }
};
```

### Mocking Complex Returns

```javascript
// Mock issue with all fields
const mockIssue = {
  _id: 'issue-123',
  identifier: 'TEST-1',
  title: 'Test Issue',
  description: 'Description',
  status: 'backlog',
  priority: 'medium',
  component: 'component-id',
  milestone: 'milestone-id',
  assignee: 'user-id',
  dueDate: new Date('2024-12-31').getTime(),
  estimation: 8,
  modifiedOn: Date.now()
};

// Mock with related data
mockClient.findAll.mockImplementation((className) => {
  if (className === tracker.class.Issue) return [mockIssue];
  if (className === tracker.class.Component) return [mockComponent];
  return [];
});
```

## Best Practices

### 1. Use Descriptive Test Names

```javascript
// ❌ Bad
it('should work', () => {});

// ✅ Good
it('should return error when project identifier exceeds 5 characters', () => {});
```

### 2. Test One Thing at a Time

```javascript
// ❌ Bad - Testing multiple validations
it('should validate input', () => {
  expect(validate({})).toHaveProperty('title');
  expect(validate({ title: '' })).toHaveProperty('title');
  expect(validate({ priority: 'invalid' })).toHaveProperty('priority');
});

// ✅ Good - Separate tests
it('should require title field', () => {
  const errors = validate({});
  expect(errors.title).toBe('Title is required');
});

it('should reject empty title', () => {
  const errors = validate({ title: '' });
  expect(errors.title).toBe('Title cannot be empty');
});
```

### 3. Use Setup and Teardown

```javascript
describe('IssueHandler', () => {
  let mockContext;

  beforeEach(() => {
    // Fresh mock for each test
    mockContext = createMockContext();
  });

  afterEach(() => {
    // Clean up
    jest.clearAllMocks();
  });
});
```

### 4. Test Error Scenarios

```javascript
it('should handle network errors gracefully', async () => {
  mockClient.findAll.mockRejectedValue(new Error('Network error'));
  
  const result = await handler({}, mockContext);
  
  expect(result.content[0].text).toContain('Error');
  expect(mockContext.logger.error).toHaveBeenCalledWith(
    expect.stringContaining('Failed'),
    expect.any(Error)
  );
});
```

### 5. Test Edge Cases

```javascript
describe('edge cases', () => {
  it('should handle maximum length inputs', () => {
    const longTitle = 'A'.repeat(255);
    expect(validate({ title: longTitle })).toBeNull();
  });

  it('should reject inputs exceeding maximum length', () => {
    const tooLongTitle = 'A'.repeat(256);
    const errors = validate({ title: tooLongTitle });
    expect(errors.title).toContain('exceeds maximum length');
  });

  it('should handle unicode characters', () => {
    const unicodeTitle = '测试项目 🚀';
    expect(validate({ title: unicodeTitle })).toBeNull();
  });
});
```

## Example Test Template

Here's a complete template for testing a new tool:

```javascript
/**
 * Tests for MyNewTool
 * 
 * @jest-environment node
 */

import { jest } from '@jest/globals';
import { definition, handler, validate } from '../myNewTool.js';
import { createToolResponse, createErrorResponse } from '../../base/ToolInterface.js';

describe('MyNewTool', () => {
  describe('Definition', () => {
    it('should have valid tool definition', () => {
      expect(definition.name).toBe('huly_my_new_tool');
      expect(definition.description).toBeDefined();
      expect(definition.inputSchema.type).toBe('object');
      expect(definition.inputSchema.properties).toBeDefined();
      expect(definition.inputSchema.required).toBeInstanceOf(Array);
    });

    it('should define all expected properties', () => {
      const { properties } = definition.inputSchema;
      expect(properties.field1).toBeDefined();
      expect(properties.field2).toBeDefined();
    });
  });

  describe('Handler', () => {
    let mockContext;

    beforeEach(() => {
      mockContext = {
        client: {},
        services: {
          myService: {
            myMethod: jest.fn()
          }
        },
        logger: {
          debug: jest.fn(),
          error: jest.fn()
        }
      };
    });

    it('should execute successfully with valid input', async () => {
      // Arrange
      const input = { field1: 'value1', field2: 'value2' };
      const expectedResult = { success: true };
      mockContext.services.myService.myMethod.mockResolvedValue(expectedResult);

      // Act
      const result = await handler(input, mockContext);

      // Assert
      expect(mockContext.services.myService.myMethod).toHaveBeenCalledWith(
        mockContext.client,
        'value1',
        'value2'
      );
      expect(result).toEqual(expectedResult);
    });

    it('should handle service errors', async () => {
      // Arrange
      const input = { field1: 'value1' };
      const error = new Error('Service error');
      mockContext.services.myService.myMethod.mockRejectedValue(error);

      // Act
      const result = await handler(input, mockContext);

      // Assert
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalled();
    });

    it('should handle missing optional fields', async () => {
      // Test with minimal required fields only
      const minimalInput = { field1: 'required' };
      mockContext.services.myService.myMethod.mockResolvedValue({ success: true });

      const result = await handler(minimalInput, mockContext);

      expect(mockContext.services.myService.myMethod).toHaveBeenCalledWith(
        mockContext.client,
        'required',
        undefined // optional field2
      );
    });
  });

  describe('Validation', () => {
    it('should accept valid input', () => {
      const validInput = {
        field1: 'valid value',
        field2: 'another valid value'
      };

      expect(validate(validInput)).toBeNull();
    });

    it('should require mandatory fields', () => {
      const errors = validate({});
      
      expect(errors).toBeDefined();
      expect(errors.field1).toBe('Field1 is required');
    });

    it('should validate field formats', () => {
      const errors = validate({
        field1: '', // Empty not allowed
        field2: 'x'.repeat(256) // Too long
      });

      expect(errors.field1).toContain('cannot be empty');
      expect(errors.field2).toContain('exceeds maximum length');
    });

    it('should ignore unknown fields', () => {
      const input = {
        field1: 'valid',
        unknownField: 'ignored'
      };

      expect(validate(input)).toBeNull();
    });

    it('should handle multiple validation errors', () => {
      const errors = validate({
        field1: '',
        field2: 'invalid-format'
      });

      expect(Object.keys(errors).length).toBe(2);
      expect(errors.field1).toBeDefined();
      expect(errors.field2).toBeDefined();
    });
  });
});
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests for a specific tool
npm test -- createProject.test.js

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

## Test Checklist for New Tools

When creating a new tool, ensure your tests cover:

- [ ] Tool definition exports and structure
- [ ] All required fields in input schema
- [ ] Handler success scenarios
- [ ] Handler error scenarios
- [ ] Validation for all required fields
- [ ] Validation for field formats/patterns
- [ ] Validation for enum values
- [ ] Edge cases (empty strings, max lengths, special characters)
- [ ] Proper error message formatting
- [ ] Logger usage in handlers
- [ ] Service method calls with correct parameters

## Continuous Integration

Tests are automatically run in CI/CD pipeline. Ensure:

1. All tests pass locally before pushing
2. No console.log statements in tests
3. Tests don't depend on external services
4. Tests clean up after themselves
5. Tests run in reasonable time (<100ms per test)

## Questions?

If you need help with testing or encounter issues:

1. Check existing tool tests for examples
2. Review Jest documentation
3. Ask the team for guidance
4. Create an issue if you find testing gaps