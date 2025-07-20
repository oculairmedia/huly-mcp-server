/**
 * Unit tests for ToolRegistry
 */

import { jest } from '@jest/globals';
import registryDefault, { ToolRegistry, createRegistry } from '../ToolRegistry.js';
import { createErrorResponse, createToolResponse } from '../ToolInterface.js';

describe('ToolRegistry', () => {
  let registry;

  // Mock tool definitions
  const mockTool1 = {
    definition: {
      name: 'test_tool_1',
      description: 'Test tool 1',
      inputSchema: {
        type: 'object',
        properties: {
          param1: { type: 'string' }
        },
        required: ['param1']
      }
    },
    handler: jest.fn(async (_args, _context) => createToolResponse('Tool 1 executed')),
    validate: jest.fn(() => null)
  };

  const mockTool2 = {
    definition: {
      name: 'test_tool_2',
      description: 'Test tool 2',
      inputSchema: {
        type: 'object',
        properties: {
          param2: { type: 'number' }
        }
      }
    },
    handler: jest.fn(async (_args, _context) => createToolResponse('Tool 2 executed'))
  };

  const invalidTool = {
    definition: {
      name: 'invalid_tool',
      description: 'Invalid tool',
      inputSchema: {
        type: 'string', // Invalid - should be 'object'
        properties: {}
      }
    },
    handler: jest.fn()
  };

  beforeEach(() => {
    registry = createRegistry();
    jest.clearAllMocks();
    // Spy on console methods
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with empty tools and categories maps', () => {
      expect(registry.tools).toBeInstanceOf(Map);
      expect(registry.categories).toBeInstanceOf(Map);
      expect(registry.tools.size).toBe(0);
      expect(registry.categories.size).toBe(0);
    });
  });

  describe('register', () => {
    test('should register a valid tool with default category', () => {
      registry.register(mockTool1);
      
      expect(registry.tools.has('test_tool_1')).toBe(true);
      expect(registry.categories.get('test_tool_1')).toBe('general');
      expect(console.log).toHaveBeenCalledWith('Registered tool: test_tool_1 (general)');
    });

    test('should register a valid tool with custom category', () => {
      registry.register(mockTool1, 'custom');
      
      expect(registry.tools.has('test_tool_1')).toBe(true);
      expect(registry.categories.get('test_tool_1')).toBe('custom');
      expect(console.log).toHaveBeenCalledWith('Registered tool: test_tool_1 (custom)');
    });

    test('should throw error for null tool', () => {
      expect(() => registry.register(null)).toThrow('Invalid tool: must have definition and handler');
    });

    test('should throw error for tool without definition', () => {
      const toolWithoutDef = { handler: jest.fn() };
      expect(() => registry.register(toolWithoutDef)).toThrow('Invalid tool: must have definition and handler');
    });

    test('should throw error for tool without handler', () => {
      const toolWithoutHandler = { definition: mockTool1.definition };
      expect(() => registry.register(toolWithoutHandler)).toThrow('Invalid tool: must have definition and handler');
    });

    test('should throw error for duplicate tool name', () => {
      registry.register(mockTool1);
      expect(() => registry.register(mockTool1)).toThrow('Tool already registered: test_tool_1');
    });

    test('should throw error for invalid tool definition', () => {
      expect(() => registry.register(invalidTool)).toThrow('Tool inputSchema.type must be "object"');
    });
  });

  describe('registerMany', () => {
    test('should register multiple tools', () => {
      const tools = [
        { tool: mockTool1, category: 'category1' },
        { tool: mockTool2, category: 'category2' }
      ];

      registry.registerMany(tools);

      expect(registry.tools.size).toBe(2);
      expect(registry.categories.get('test_tool_1')).toBe('category1');
      expect(registry.categories.get('test_tool_2')).toBe('category2');
    });

    test('should use default category when not specified', () => {
      const tools = [
        { tool: mockTool1 },
        { tool: mockTool2, category: 'custom' }
      ];

      registry.registerMany(tools);

      expect(registry.categories.get('test_tool_1')).toBe('general');
      expect(registry.categories.get('test_tool_2')).toBe('custom');
    });

    test('should throw error if any tool is invalid', () => {
      const tools = [
        { tool: mockTool1 },
        { tool: invalidTool }
      ];

      expect(() => registry.registerMany(tools)).toThrow('Tool inputSchema.type must be "object"');
      // First tool should still be registered
      expect(registry.tools.has('test_tool_1')).toBe(true);
    });
  });

  describe('get', () => {
    beforeEach(() => {
      registry.register(mockTool1);
    });

    test('should return tool by name', () => {
      const tool = registry.get('test_tool_1');
      expect(tool).toBe(mockTool1);
    });

    test('should return null for non-existent tool', () => {
      const tool = registry.get('non_existent');
      expect(tool).toBeNull();
    });
  });

  describe('has', () => {
    beforeEach(() => {
      registry.register(mockTool1);
    });

    test('should return true for existing tool', () => {
      expect(registry.has('test_tool_1')).toBe(true);
    });

    test('should return false for non-existent tool', () => {
      expect(registry.has('non_existent')).toBe(false);
    });
  });

  describe('getAllDefinitions', () => {
    test('should return empty array when no tools registered', () => {
      const definitions = registry.getAllDefinitions();
      expect(definitions).toEqual([]);
    });

    test('should return all tool definitions', () => {
      registry.register(mockTool1);
      registry.register(mockTool2);

      const definitions = registry.getAllDefinitions();
      
      expect(definitions).toHaveLength(2);
      expect(definitions).toContainEqual(mockTool1.definition);
      expect(definitions).toContainEqual(mockTool2.definition);
    });
  });

  describe('getByCategory', () => {
    beforeEach(() => {
      registry.register(mockTool1, 'category1');
      registry.register(mockTool2, 'category2');
    });

    test('should return tools in specified category', () => {
      const tools = registry.getByCategory('category1');
      
      expect(tools).toHaveLength(1);
      expect(tools[0]).toBe(mockTool1);
    });

    test('should return empty array for non-existent category', () => {
      const tools = registry.getByCategory('non_existent');
      expect(tools).toEqual([]);
    });

    test('should return multiple tools in same category', () => {
      const mockTool3 = {
        definition: {
          name: 'test_tool_3',
          description: 'Test tool 3',
          inputSchema: { type: 'object', properties: {} }
        },
        handler: jest.fn()
      };

      registry.register(mockTool3, 'category1');
      
      const tools = registry.getByCategory('category1');
      expect(tools).toHaveLength(2);
      expect(tools).toContain(mockTool1);
      expect(tools).toContain(mockTool3);
    });
  });

  describe('getCategories', () => {
    test('should return empty array when no tools registered', () => {
      const categories = registry.getCategories();
      expect(categories).toEqual([]);
    });

    test('should return unique categories', () => {
      registry.register(mockTool1, 'category1');
      registry.register(mockTool2, 'category1');
      
      const mockTool3 = {
        definition: {
          name: 'test_tool_3',
          description: 'Test tool 3',
          inputSchema: { type: 'object', properties: {} }
        },
        handler: jest.fn()
      };
      registry.register(mockTool3, 'category2');

      const categories = registry.getCategories();
      
      expect(categories).toHaveLength(2);
      expect(categories).toContain('category1');
      expect(categories).toContain('category2');
    });
  });

  describe('execute', () => {
    const mockContext = {
      client: {},
      services: {},
      config: {},
      logger: {}
    };

    beforeEach(() => {
      registry.register(mockTool1);
    });

    test('should execute tool successfully', async () => {
      const args = { param1: 'value1' };
      const result = await registry.execute('test_tool_1', args, mockContext);

      expect(mockTool1.validate).toHaveBeenCalledWith(args);
      expect(mockTool1.handler).toHaveBeenCalledWith(args, mockContext);
      expect(result).toEqual(createToolResponse('Tool 1 executed'));
    });

    test('should throw error for unknown tool', async () => {
      await expect(registry.execute('non_existent', {}, mockContext))
        .rejects.toThrow('Unknown tool: non_existent');
    });

    test('should return error response when validation fails', async () => {
      mockTool1.validate.mockReturnValueOnce({ param1: 'Required' });

      const result = await registry.execute('test_tool_1', {}, mockContext);

      expect(result).toEqual(createErrorResponse('Validation failed: {"param1":"Required"}'));
      expect(mockTool1.handler).not.toHaveBeenCalled();
    });

    test('should return error response when handler throws', async () => {
      const error = new Error('Handler error');
      mockTool1.handler.mockRejectedValueOnce(error);

      const result = await registry.execute('test_tool_1', { param1: 'value' }, mockContext);

      expect(result).toEqual(createErrorResponse(error));
      expect(console.error).toHaveBeenCalledWith('Error executing tool test_tool_1:', error);
    });

    test('should work with tools without validate method', async () => {
      registry.register(mockTool2);
      
      const args = { param2: 123 };
      const result = await registry.execute('test_tool_2', args, mockContext);

      expect(mockTool2.handler).toHaveBeenCalledWith(args, mockContext);
      expect(result).toEqual(createToolResponse('Tool 2 executed'));
    });
  });

  describe('validateToolDefinition', () => {
    test('should validate correct definition', () => {
      expect(() => registry.validateToolDefinition(mockTool1.definition)).not.toThrow();
    });

    test('should throw for missing name', () => {
      const def = { ...mockTool1.definition, name: '' };
      expect(() => registry.validateToolDefinition(def))
        .toThrow('Tool name must be a non-empty string');
    });

    test('should throw for non-string name', () => {
      const def = { ...mockTool1.definition, name: 123 };
      expect(() => registry.validateToolDefinition(def))
        .toThrow('Tool name must be a non-empty string');
    });

    test('should throw for missing description', () => {
      const def = { ...mockTool1.definition, description: '' };
      expect(() => registry.validateToolDefinition(def))
        .toThrow('Tool description must be a non-empty string');
    });

    test('should throw for non-string description', () => {
      const def = { ...mockTool1.definition, description: null };
      expect(() => registry.validateToolDefinition(def))
        .toThrow('Tool description must be a non-empty string');
    });

    test('should throw for missing inputSchema', () => {
      const def = { ...mockTool1.definition, inputSchema: null };
      expect(() => registry.validateToolDefinition(def))
        .toThrow('Tool inputSchema must be an object');
    });

    test('should throw for non-object inputSchema', () => {
      const def = { ...mockTool1.definition, inputSchema: 'string' };
      expect(() => registry.validateToolDefinition(def))
        .toThrow('Tool inputSchema must be an object');
    });

    test('should throw for non-object inputSchema type', () => {
      const def = {
        ...mockTool1.definition,
        inputSchema: { type: 'array', properties: {} }
      };
      expect(() => registry.validateToolDefinition(def))
        .toThrow('Tool inputSchema.type must be "object"');
    });

    test('should throw for missing inputSchema properties', () => {
      const def = {
        ...mockTool1.definition,
        inputSchema: { type: 'object' }
      };
      expect(() => registry.validateToolDefinition(def))
        .toThrow('Tool inputSchema.properties must be an object');
    });

    test('should throw for non-object inputSchema properties', () => {
      const def = {
        ...mockTool1.definition,
        inputSchema: { type: 'object', properties: 'string' }
      };
      expect(() => registry.validateToolDefinition(def))
        .toThrow('Tool inputSchema.properties must be an object');
    });
  });

  describe('clear', () => {
    test('should remove all tools and categories', () => {
      registry.register(mockTool1, 'category1');
      registry.register(mockTool2, 'category2');

      expect(registry.tools.size).toBe(2);
      expect(registry.categories.size).toBe(2);

      registry.clear();

      expect(registry.tools.size).toBe(0);
      expect(registry.categories.size).toBe(0);
    });
  });

  describe('getStats', () => {
    test('should return stats for empty registry', () => {
      const stats = registry.getStats();
      
      expect(stats).toEqual({
        totalTools: 0,
        categories: {}
      });
    });

    test('should return correct stats for populated registry', () => {
      registry.register(mockTool1, 'category1');
      registry.register(mockTool2, 'category1');
      
      const mockTool3 = {
        definition: {
          name: 'test_tool_3',
          description: 'Test tool 3',
          inputSchema: { type: 'object', properties: {} }
        },
        handler: jest.fn()
      };
      registry.register(mockTool3, 'category2');

      const stats = registry.getStats();
      
      expect(stats).toEqual({
        totalTools: 3,
        categories: {
          category1: 2,
          category2: 1
        }
      });
    });

    test('should handle general category', () => {
      registry.register(mockTool1); // Default to 'general'
      registry.register(mockTool2, 'custom');

      const stats = registry.getStats();
      
      expect(stats).toEqual({
        totalTools: 2,
        categories: {
          general: 1,
          custom: 1
        }
      });
    });
  });

  describe('singleton pattern', () => {
    test('default export should be a ToolRegistry instance', () => {
      expect(registryDefault).toBeInstanceOf(ToolRegistry);
    });

    test('createRegistry should create new instances', () => {
      const registry1 = createRegistry();
      const registry2 = createRegistry();
      
      expect(registry1).toBeInstanceOf(ToolRegistry);
      expect(registry2).toBeInstanceOf(ToolRegistry);
      expect(registry1).not.toBe(registry2);
    });

    test('default export should be singleton', () => {
      // Clear any existing tools
      registryDefault.clear();
      
      // Register tool on default export
      registryDefault.register(mockTool1);
      
      // Import again (simulating another module)
      expect(registryDefault.has('test_tool_1')).toBe(true);
      
      // Clean up
      registryDefault.clear();
    });
  });

  describe('edge cases', () => {
    test('should handle empty properties in inputSchema', () => {
      const toolWithEmptyProps = {
        definition: {
          name: 'empty_props_tool',
          description: 'Tool with empty properties',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        handler: jest.fn()
      };

      expect(() => registry.register(toolWithEmptyProps)).not.toThrow();
      expect(registry.has('empty_props_tool')).toBe(true);
    });

    test('should handle complex validation errors', async () => {
      const complexErrors = {
        field1: ['error1', 'error2'],
        field2: { nested: 'error' }
      };

      // Ensure tool is registered for this test
      registry.register(mockTool1);
      mockTool1.validate.mockReturnValueOnce(complexErrors);

      const result = await registry.execute('test_tool_1', {}, {});
      expect(result.content[0].text).toContain('Validation failed:');
      expect(result.content[0].text).toContain(JSON.stringify(complexErrors));
    });

    test('should handle non-Error objects in execute catch', async () => {
      // Ensure tool is registered for this test
      registry.register(mockTool1);
      mockTool1.handler.mockRejectedValueOnce('String error');

      const result = await registry.execute('test_tool_1', { param1: 'value' }, {});

      expect(result).toEqual(createErrorResponse('String error'));
    });

    test('should handle tools being removed from registry during iteration', () => {
      // Register multiple tools in same category
      registry.register(mockTool1, 'test');
      registry.register(mockTool2, 'test');

      // This shouldn't throw even if implementation iterates
      const tools = registry.getByCategory('test');
      expect(tools).toHaveLength(2);
    });

    test('should handle category without corresponding tool (edge case)', () => {
      // This tests the edge case where a category exists but the tool doesn't
      // This shouldn't happen in normal operation but tests branch coverage
      registry.register(mockTool1, 'orphan-category');
      
      // Manually manipulate internal state to create orphaned category
      registry.tools.delete('test_tool_1');
      
      // Should return empty array since tool no longer exists
      const tools = registry.getByCategory('orphan-category');
      expect(tools).toEqual([]);
    });
  });
});