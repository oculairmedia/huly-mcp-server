/**
 * Tests for ToolInterface.js
 * Tests the BaseTool class and helper functions
 */

import { BaseTool, createToolResponse, createErrorResponse } from '../ToolInterface.js';

describe('BaseTool', () => {
  describe('constructor and validateDefinition', () => {
    it('should create a valid tool with complete definition', () => {
      const definition = {
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: {
            param1: { type: 'string' },
          },
        },
      };

      const tool = new BaseTool(definition);
      expect(tool.definition).toEqual(definition);
    });

    it('should throw error when name is missing', () => {
      const definition = {
        description: 'A test tool',
        inputSchema: { type: 'object' },
      };

      expect(() => new BaseTool(definition)).toThrow('Tool name is required');
    });

    it('should throw error when name is empty string', () => {
      const definition = {
        name: '',
        description: 'A test tool',
        inputSchema: { type: 'object' },
      };

      expect(() => new BaseTool(definition)).toThrow('Tool name is required');
    });

    it('should throw error when description is missing', () => {
      const definition = {
        name: 'test_tool',
        inputSchema: { type: 'object' },
      };

      expect(() => new BaseTool(definition)).toThrow('Tool description is required');
    });

    it('should throw error when description is empty string', () => {
      const definition = {
        name: 'test_tool',
        description: '',
        inputSchema: { type: 'object' },
      };

      expect(() => new BaseTool(definition)).toThrow('Tool description is required');
    });

    it('should throw error when inputSchema is missing', () => {
      const definition = {
        name: 'test_tool',
        description: 'A test tool',
      };

      expect(() => new BaseTool(definition)).toThrow('Tool inputSchema is required');
    });

    it('should throw error when inputSchema type is not object', () => {
      const definition = {
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: { type: 'string' },
      };

      expect(() => new BaseTool(definition)).toThrow('Tool inputSchema must be an object schema');
    });

    it('should throw error when inputSchema type is array', () => {
      const definition = {
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: { type: 'array' },
      };

      expect(() => new BaseTool(definition)).toThrow('Tool inputSchema must be an object schema');
    });

    it('should throw error when inputSchema has no type property', () => {
      const definition = {
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: { properties: {} },
      };

      expect(() => new BaseTool(definition)).toThrow('Tool inputSchema must be an object schema');
    });
  });

  describe('handler method', () => {
    let tool;

    beforeEach(() => {
      tool = new BaseTool({
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: { type: 'object' },
      });
    });

    it('should throw not implemented error when called', async () => {
      const args = { param1: 'value' };
      const context = { client: {}, services: {} };

      await expect(tool.handler(args, context)).rejects.toThrow(
        'Handler not implemented for tool: test_tool'
      );
    });

    it('should include tool name in error message', async () => {
      const customTool = new BaseTool({
        name: 'custom_tool_name',
        description: 'A custom tool',
        inputSchema: { type: 'object' },
      });

      await expect(customTool.handler({}, {})).rejects.toThrow(
        'Handler not implemented for tool: custom_tool_name'
      );
    });
  });

  describe('validate method', () => {
    let tool;

    beforeEach(() => {
      tool = new BaseTool({
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: { type: 'object' },
      });
    });

    it('should return null by default', () => {
      const result = tool.validate({ param1: 'value' });
      expect(result).toBeNull();
    });

    it('should return null for empty args', () => {
      const result = tool.validate({});
      expect(result).toBeNull();
    });

    it('should return null for any args', () => {
      const result = tool.validate({
        string: 'test',
        number: 123,
        boolean: true,
        array: [1, 2, 3],
        object: { nested: 'value' },
      });
      expect(result).toBeNull();
    });
  });

  describe('export method', () => {
    let tool;

    beforeEach(() => {
      tool = new BaseTool({
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: { type: 'object' },
      });
    });

    it('should return correct structure', () => {
      const exported = tool.export();

      expect(exported).toHaveProperty('definition');
      expect(exported).toHaveProperty('handler');
      expect(exported).toHaveProperty('validate');
      expect(exported.definition).toBe(tool.definition);
      expect(typeof exported.handler).toBe('function');
      expect(typeof exported.validate).toBe('function');
    });

    it('should bind handler method correctly', async () => {
      const exported = tool.export();

      await expect(exported.handler({}, {})).rejects.toThrow(
        'Handler not implemented for tool: test_tool'
      );
    });

    it('should bind validate method correctly', () => {
      const exported = tool.export();
      const result = exported.validate({ test: 'value' });

      expect(result).toBeNull();
    });

    it('should maintain this context in exported methods', async () => {
      // Create a custom tool with overridden methods
      class CustomTool extends BaseTool {
        constructor(definition) {
          super(definition);
          this.customProperty = 'custom value';
        }

        async handler(_args, _context) {
          return this.customProperty;
        }

        validate(_args) {
          return this.customProperty;
        }
      }

      const customTool = new CustomTool({
        name: 'custom_tool',
        description: 'A custom tool',
        inputSchema: { type: 'object' },
      });

      const exported = customTool.export();

      expect(await exported.handler({}, {})).toBe('custom value');
      expect(exported.validate({})).toBe('custom value');
    });
  });
});

describe('createToolResponse', () => {
  it('should create response with correct structure', () => {
    const response = createToolResponse('Test response');

    expect(response).toEqual({
      content: [
        {
          type: 'text',
          text: 'Test response',
        },
      ],
    });
  });

  it('should handle empty string', () => {
    const response = createToolResponse('');

    expect(response).toEqual({
      content: [
        {
          type: 'text',
          text: '',
        },
      ],
    });
  });

  it('should handle multiline text', () => {
    const multilineText = 'Line 1\nLine 2\nLine 3';
    const response = createToolResponse(multilineText);

    expect(response).toEqual({
      content: [
        {
          type: 'text',
          text: multilineText,
        },
      ],
    });
  });

  it('should handle special characters', () => {
    const specialText = 'Special chars: !@#$%^&*()_+-={}[]|\\:";\'<>?,./';
    const response = createToolResponse(specialText);

    expect(response).toEqual({
      content: [
        {
          type: 'text',
          text: specialText,
        },
      ],
    });
  });

  it('should handle unicode characters', () => {
    const unicodeText = 'Unicode: 你好世界 🌍 🚀 ✨';
    const response = createToolResponse(unicodeText);

    expect(response).toEqual({
      content: [
        {
          type: 'text',
          text: unicodeText,
        },
      ],
    });
  });
});

describe('createErrorResponse', () => {
  it('should handle Error object', () => {
    const error = new Error('Test error message');
    const response = createErrorResponse(error);

    expect(response).toEqual({
      content: [
        {
          type: 'text',
          text: 'Error: Test error message',
        },
      ],
    });
  });

  it('should handle string error', () => {
    const response = createErrorResponse('String error message');

    expect(response).toEqual({
      content: [
        {
          type: 'text',
          text: 'Error: String error message',
        },
      ],
    });
  });

  it('should handle Error with empty message', () => {
    const error = new Error('');
    const response = createErrorResponse(error);

    expect(response).toEqual({
      content: [
        {
          type: 'text',
          text: 'Error: ',
        },
      ],
    });
  });

  it('should handle empty string error', () => {
    const response = createErrorResponse('');

    expect(response).toEqual({
      content: [
        {
          type: 'text',
          text: 'Error: ',
        },
      ],
    });
  });

  it('should handle custom Error types', () => {
    class CustomError extends Error {
      constructor(message) {
        super(message);
        this.name = 'CustomError';
      }
    }

    const error = new CustomError('Custom error message');
    const response = createErrorResponse(error);

    expect(response).toEqual({
      content: [
        {
          type: 'text',
          text: 'Error: Custom error message',
        },
      ],
    });
  });

  it('should handle Error with multiline message', () => {
    const error = new Error('Line 1\nLine 2\nLine 3');
    const response = createErrorResponse(error);

    expect(response).toEqual({
      content: [
        {
          type: 'text',
          text: 'Error: Line 1\nLine 2\nLine 3',
        },
      ],
    });
  });

  it('should use createToolResponse internally', () => {
    // This test verifies that createErrorResponse uses createToolResponse
    const errorText = 'Test error';
    const errorResponse = createErrorResponse(errorText);
    const toolResponse = createToolResponse(`Error: ${errorText}`);

    expect(errorResponse).toEqual(toolResponse);
  });
});
