/**
 * Example Test File for Tool Testing
 * 
 * This file demonstrates best practices for testing tools in the
 * Huly MCP Server. Copy this file as a starting point for your tests.
 * 
 * @jest-environment node
 */

import { jest } from '@jest/globals';

// Import your tool exports
// import { definition, handler, validate } from '../../src/tools/category/myTool.js';

// Mock any dependencies
jest.unstable_mockModule('../../src/config/index.js', () => ({
  getConfigManager: jest.fn(() => ({
    getHulyConfig: jest.fn(() => ({ test: true })),
  })),
}));

jest.unstable_mockModule('../../src/utils/index.js', () => ({
  createLoggerWithConfig: jest.fn(() => ({
    child: jest.fn(() => ({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    })),
  })),
}));

// Example tool definition for testing
const definition = {
  name: 'huly_example_tool',
  description: 'An example tool for demonstration',
  inputSchema: {
    type: 'object',
    properties: {
      requiredField: {
        type: 'string',
        description: 'A required field'
      },
      optionalField: {
        type: 'string',
        description: 'An optional field'
      },
      enumField: {
        type: 'string',
        description: 'Field with enum values',
        enum: ['option1', 'option2', 'option3']
      },
      numberField: {
        type: 'number',
        description: 'A numeric field'
      }
    },
    required: ['requiredField']
  }
};

// Example handler implementation
async function handler(args, context) {
  const { client, services, logger } = context;
  
  try {
    logger.debug('Executing example tool', args);
    
    // Call service method
    const result = await services.exampleService.doSomething(
      client,
      args.requiredField,
      args.optionalField,
      args.enumField,
      args.numberField
    );
    
    return result;
  } catch (error) {
    logger.error('Failed to execute example tool:', error);
    return {
      content: [{
        type: 'text',
        text: `❌ Error: ${error.message}`
      }]
    };
  }
}

// Example validation function
function validate(args) {
  const errors = {};
  
  // Required field validation
  if (!args.requiredField) {
    errors.requiredField = 'Required field is missing';
  } else if (args.requiredField.trim().length === 0) {
    errors.requiredField = 'Required field cannot be empty';
  } else if (args.requiredField.length > 100) {
    errors.requiredField = 'Required field exceeds maximum length of 100 characters';
  }
  
  // Optional field validation (only if provided)
  if (args.optionalField !== undefined) {
    if (typeof args.optionalField !== 'string') {
      errors.optionalField = 'Optional field must be a string';
    } else if (args.optionalField.length > 200) {
      errors.optionalField = 'Optional field exceeds maximum length of 200 characters';
    }
  }
  
  // Enum validation
  if (args.enumField !== undefined) {
    const validOptions = ['option1', 'option2', 'option3'];
    if (!validOptions.includes(args.enumField)) {
      errors.enumField = `Enum field must be one of: ${validOptions.join(', ')}`;
    }
  }
  
  // Number validation
  if (args.numberField !== undefined) {
    if (typeof args.numberField !== 'number') {
      errors.numberField = 'Number field must be a number';
    } else if (args.numberField < 0 || args.numberField > 100) {
      errors.numberField = 'Number field must be between 0 and 100';
    }
  }
  
  return Object.keys(errors).length > 0 ? errors : null;
}

describe('ExampleTool', () => {
  describe('Definition', () => {
    it('should have a valid tool definition', () => {
      expect(definition).toBeDefined();
      expect(definition.name).toBe('huly_example_tool');
      expect(definition.description).toBeDefined();
      expect(definition.inputSchema).toBeDefined();
    });

    it('should have correct input schema structure', () => {
      expect(definition.inputSchema.type).toBe('object');
      expect(definition.inputSchema.properties).toBeDefined();
      expect(definition.inputSchema.required).toEqual(['requiredField']);
    });

    it('should define all expected properties', () => {
      const { properties } = definition.inputSchema;
      expect(properties.requiredField).toBeDefined();
      expect(properties.optionalField).toBeDefined();
      expect(properties.enumField).toBeDefined();
      expect(properties.numberField).toBeDefined();
    });
  });

  describe('Handler', () => {
    let mockContext;

    beforeEach(() => {
      // Create fresh mock context for each test
      mockContext = {
        client: { id: 'test-client' },
        services: {
          exampleService: {
            doSomething: jest.fn()
          }
        },
        logger: {
          debug: jest.fn(),
          error: jest.fn()
        }
      };
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should execute successfully with minimum required input', async () => {
      // Arrange
      const input = { requiredField: 'test value' };
      const expectedResponse = {
        content: [{
          type: 'text',
          text: '✅ Operation completed successfully'
        }]
      };
      
      mockContext.services.exampleService.doSomething.mockResolvedValue(expectedResponse);

      // Act
      const result = await handler(input, mockContext);

      // Assert
      expect(mockContext.logger.debug).toHaveBeenCalledWith('Executing example tool', input);
      expect(mockContext.services.exampleService.doSomething).toHaveBeenCalledWith(
        mockContext.client,
        'test value',
        undefined,
        undefined,
        undefined
      );
      expect(result).toEqual(expectedResponse);
    });

    it('should execute successfully with all fields provided', async () => {
      // Arrange
      const input = {
        requiredField: 'required',
        optionalField: 'optional',
        enumField: 'option1',
        numberField: 42
      };
      
      mockContext.services.exampleService.doSomething.mockResolvedValue({ success: true });

      // Act
      await handler(input, mockContext);

      // Assert
      expect(mockContext.services.exampleService.doSomething).toHaveBeenCalledWith(
        mockContext.client,
        'required',
        'optional',
        'option1',
        42
      );
    });

    it('should handle service errors gracefully', async () => {
      // Arrange
      const input = { requiredField: 'test' };
      const error = new Error('Service unavailable');
      
      mockContext.services.exampleService.doSomething.mockRejectedValue(error);

      // Act
      const result = await handler(input, mockContext);

      // Assert
      expect(mockContext.logger.error).toHaveBeenCalledWith(
        'Failed to execute example tool:',
        error
      );
      expect(result.content[0].text).toBe('❌ Error: Service unavailable');
    });

    it('should handle unexpected errors', async () => {
      // Arrange
      const input = { requiredField: 'test' };
      
      // Simulate unexpected error (non-Error object)
      mockContext.services.exampleService.doSomething.mockRejectedValue('String error');

      // Act
      const result = await handler(input, mockContext);

      // Assert
      expect(result.content[0].text).toContain('❌ Error:');
    });
  });

  describe('Validation', () => {
    it('should accept valid input with all fields', () => {
      const input = {
        requiredField: 'valid required field',
        optionalField: 'valid optional field',
        enumField: 'option2',
        numberField: 50
      };

      expect(validate(input)).toBeNull();
    });

    it('should accept valid input with only required fields', () => {
      const input = {
        requiredField: 'valid required field'
      };

      expect(validate(input)).toBeNull();
    });

    it('should reject missing required field', () => {
      const errors = validate({});
      
      expect(errors).toBeDefined();
      expect(errors.requiredField).toBe('Required field is missing');
      expect(Object.keys(errors).length).toBe(1);
    });

    it('should reject empty required field', () => {
      const errors = validate({ requiredField: '   ' });
      
      expect(errors.requiredField).toBe('Required field cannot be empty');
    });

    it('should reject required field exceeding max length', () => {
      const longString = 'a'.repeat(101);
      const errors = validate({ requiredField: longString });
      
      expect(errors.requiredField).toContain('exceeds maximum length');
    });

    it('should validate optional field when provided', () => {
      const errors = validate({
        requiredField: 'valid',
        optionalField: 'a'.repeat(201)
      });
      
      expect(errors.optionalField).toContain('exceeds maximum length');
    });

    it('should ignore missing optional fields', () => {
      const input = { requiredField: 'valid' };
      
      expect(validate(input)).toBeNull();
    });

    it('should validate enum field values', () => {
      const errors = validate({
        requiredField: 'valid',
        enumField: 'invalid-option'
      });
      
      expect(errors.enumField).toContain('must be one of: option1, option2, option3');
    });

    it('should validate number field type', () => {
      const errors = validate({
        requiredField: 'valid',
        numberField: 'not-a-number'
      });
      
      expect(errors.numberField).toBe('Number field must be a number');
    });

    it('should validate number field range', () => {
      const errors1 = validate({
        requiredField: 'valid',
        numberField: -1
      });
      
      const errors2 = validate({
        requiredField: 'valid',
        numberField: 101
      });
      
      expect(errors1.numberField).toContain('must be between 0 and 100');
      expect(errors2.numberField).toContain('must be between 0 and 100');
    });

    it('should handle multiple validation errors', () => {
      const errors = validate({
        requiredField: '',
        optionalField: 'a'.repeat(201),
        enumField: 'invalid',
        numberField: 'not-a-number'
      });
      
      expect(Object.keys(errors).length).toBe(4);
      expect(errors.requiredField).toBeDefined();
      expect(errors.optionalField).toBeDefined();
      expect(errors.enumField).toBeDefined();
      expect(errors.numberField).toBeDefined();
    });

    it('should ignore unknown fields', () => {
      const input = {
        requiredField: 'valid',
        unknownField1: 'ignored',
        unknownField2: 123
      };
      
      expect(validate(input)).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle unicode characters in text fields', () => {
      const input = {
        requiredField: '测试 Unicode 🚀',
        optionalField: 'émojis 😊 and açcénts'
      };
      
      expect(validate(input)).toBeNull();
    });

    it('should handle whitespace properly', () => {
      const errors = validate({
        requiredField: '\t\n  \r\n  '
      });
      
      expect(errors.requiredField).toBe('Required field cannot be empty');
    });

    it('should handle boundary values for numbers', () => {
      expect(validate({ requiredField: 'valid', numberField: 0 })).toBeNull();
      expect(validate({ requiredField: 'valid', numberField: 100 })).toBeNull();
    });
  });
});