/**
 * Integration tests for MCP prompt protocol support
 */

import { jest } from '@jest/globals';
import { MCPHandler } from '../../src/protocol/MCPHandler.js';
import { promptRegistry, registerPrompt } from '../../src/prompts/base/PromptRegistry.js';
import * as configModule from '../../src/config/index.js';
import * as utilsModule from '../../src/utils/index.js';
import * as toolsModule from '../../src/tools/index.js';

// Mock external dependencies that aren't part of the prompt protocol test
jest.mock('../../src/config/index.js');
jest.mock('../../src/utils/index.js');
jest.mock('../../src/tools/index.js');

describe('MCP Prompt Protocol Integration', () => {
  let handler;
  let mockServer;
  let mockServices;
  let mockLogger;
  let requestHandlers;

  beforeEach(() => {
    // Clear the prompt registry
    promptRegistry.clear();

    // Mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      child: jest.fn(() => mockLogger)
    };

    // Mock config manager
    const mockConfigManager = {
      getHulyConfig: jest.fn(() => ({
        workspace: 'test',
        email: 'test@example.com'
      }))
    };

    jest.mocked(configModule.getConfigManager).mockReturnValue(mockConfigManager);
    jest.mocked(utilsModule.createLoggerWithConfig).mockReturnValue(mockLogger);

    // Mock tool system to avoid initialization issues
    jest.mocked(toolsModule.initializeTools).mockResolvedValue();

    // Create a mock server that captures request handlers
    requestHandlers = new Map();
    mockServer = {
      setRequestHandler: jest.fn((schema, handler) => {
        // Store handlers by method for easy access
        const method = schema.method || schema.type || 'unknown';
        requestHandlers.set(method, handler);
      })
    };

    // Mock services with client wrapper
    const mockClient = {
      findAll: jest.fn(() => Promise.resolve([])),
      createDoc: jest.fn(() => Promise.resolve({ _id: 'test-id' }))
    };

    mockServices = {
      hulyClientWrapper: {
        withClient: jest.fn((callback) => callback(mockClient))
      }
    };

    // Create handler (this will register all request handlers)
    handler = new MCPHandler(mockServer, mockServices);
  });

  afterEach(() => {
    // Clean up
    promptRegistry.clear();
  });

  describe('Prompt Registration and Listing', () => {
    it('should register prompts and list them via MCP protocol', async () => {
      // Register test prompts
      registerPrompt({
        name: 'test-prompt-1',
        description: 'First test prompt',
        handler: jest.fn(async () => ({ content: [{ type: 'text', text: 'Response 1' }] })),
        arguments: [
          { name: 'input', description: 'Input parameter', required: true }
        ]
      }, 'test-category');

      registerPrompt({
        name: 'test-prompt-2',
        description: 'Second test prompt',
        handler: jest.fn(async () => ({ content: [{ type: 'text', text: 'Response 2' }] })),
        arguments: []
      });

      // Initialize the handler
      await handler.initialize();

      // Find the list prompts handler
      const listHandler = Array.from(requestHandlers.values())
        .find(h => h.toString().includes('getAllPromptDefinitions'));

      expect(listHandler).toBeDefined();

      // Execute list prompts request
      const result = await listHandler();

      expect(result).toHaveProperty('prompts');
      expect(result.prompts).toHaveLength(2);

      // Verify first prompt
      expect(result.prompts[0]).toEqual({
        name: 'test-prompt-1',
        description: 'First test prompt',
        arguments: [
          { name: 'input', description: 'Input parameter', required: true }
        ]
      });

      // Verify second prompt
      expect(result.prompts[1]).toEqual({
        name: 'test-prompt-2',
        description: 'Second test prompt',
        arguments: []
      });
    });

    it('should handle empty prompt registry', async () => {
      await handler.initialize();

      const listHandler = Array.from(requestHandlers.values())
        .find(h => h.toString().includes('getAllPromptDefinitions'));

      const result = await listHandler();

      expect(result).toEqual({
        prompts: []
      });
    });
  });

  describe('Prompt Execution', () => {
    it('should execute prompts via MCP protocol', async () => {
      const mockHandler = jest.fn(async (args, context) => {
        // Verify context contains expected properties
        expect(context).toHaveProperty('client');
        expect(context).toHaveProperty('services');
        expect(context).toHaveProperty('config');
        expect(context).toHaveProperty('logger');

        return {
          content: [
            {
              type: 'text',
              text: `Hello ${args.name}! You provided: ${args.message}`
            }
          ]
        };
      });

      // Register a test prompt
      registerPrompt({
        name: 'greeting-prompt',
        description: 'A prompt that generates greetings',
        handler: mockHandler,
        arguments: [
          { name: 'name', description: 'Name to greet', required: true },
          { name: 'message', description: 'Message to include', required: false }
        ]
      });

      await handler.initialize();

      // Find the get prompt handler
      const getHandler = Array.from(requestHandlers.values())
        .find(h => h.toString().includes('executePrompt'));

      expect(getHandler).toBeDefined();

      // Execute prompt request
      const request = {
        params: {
          name: 'greeting-prompt',
          arguments: {
            name: 'Alice',
            message: 'Welcome to the test!'
          }
        }
      };

      const result = await getHandler(request);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'Hello Alice! You provided: Welcome to the test!'
          }
        ]
      });

      // Verify handler was called with correct arguments
      expect(mockHandler).toHaveBeenCalledWith(
        { name: 'Alice', message: 'Welcome to the test!' },
        expect.objectContaining({
          client: expect.any(Object),
          services: mockServices,
          config: expect.any(Object),
          logger: expect.any(Object)
        })
      );
    });

    it('should handle prompts with validation errors', async () => {
      // Register a prompt with required arguments
      registerPrompt({
        name: 'validation-prompt',
        description: 'A prompt that requires validation',
        handler: jest.fn(),
        arguments: [
          { name: 'required_field', description: 'This field is required', required: true }
        ]
      });

      await handler.initialize();

      const getHandler = Array.from(requestHandlers.values())
        .find(h => h.toString().includes('executePrompt'));

      // Execute prompt request without required argument
      const request = {
        params: {
          name: 'validation-prompt',
          arguments: {
            // Missing required_field
            optional_field: 'value'
          }
        }
      };

      const result = await getHandler(request);

      // Should return an error response
      expect(result).toHaveProperty('content');
      expect(result.content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('Required arguments missing')
          })
        ])
      );
    });

    it('should handle non-existent prompt requests', async () => {
      await handler.initialize();

      const getHandler = Array.from(requestHandlers.values())
        .find(h => h.toString().includes('executePrompt'));

      const request = {
        params: {
          name: 'non-existent-prompt',
          arguments: {}
        }
      };

      const result = await getHandler(request);

      expect(result).toHaveProperty('content');
      expect(result.content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('not found')
          })
        ])
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle prompt handler errors gracefully', async () => {
      // Register a prompt that throws an error
      registerPrompt({
        name: 'error-prompt',
        description: 'A prompt that throws an error',
        handler: jest.fn(async () => {
          throw new Error('Something went wrong in the prompt');
        })
      });

      await handler.initialize();

      const getHandler = Array.from(requestHandlers.values())
        .find(h => h.toString().includes('executePrompt'));

      const request = {
        params: {
          name: 'error-prompt',
          arguments: {}
        }
      };

      const result = await getHandler(request);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: '❌ Prompt Error: Something went wrong in the prompt'
          }
        ]
      });
    });

    it('should handle initialization errors', async () => {
      // Force initialization to fail
      handler.initialized = false;

      // Mock initializePrompts to throw
      const { initializePrompts } = await import('../../src/prompts/index.js');
      const originalInit = initializePrompts;
      jest.mocked(initializePrompts).mockRejectedValue(new Error('Init failed'));

      const listHandler = Array.from(requestHandlers.values())
        .find(h => h.toString().includes('getAllPromptDefinitions'));

      await expect(listHandler()).rejects.toThrow('Init failed');

      // Restore
      jest.mocked(initializePrompts).mockImplementation(originalInit);
    });
  });

  describe('Client Integration', () => {
    it('should provide Huly client to prompt handlers', async () => {
      const mockClient = {
        findAll: jest.fn(() => Promise.resolve([{ name: 'test-project' }])),
        createDoc: jest.fn(() => Promise.resolve({ _id: 'new-id' }))
      };

      mockServices.hulyClientWrapper.withClient.mockImplementation((callback) => {
        return callback(mockClient);
      });

      const clientTestHandler = jest.fn(async (args, context) => {
        // Use the client provided in context
        const projects = await context.client.findAll();
        return {
          content: [
            {
              type: 'text',
              text: `Found ${projects.length} projects`
            }
          ]
        };
      });

      registerPrompt({
        name: 'client-test',
        description: 'Tests client access',
        handler: clientTestHandler
      });

      await handler.initialize();

      const getHandler = Array.from(requestHandlers.values())
        .find(h => h.toString().includes('executePrompt'));

      const request = {
        params: {
          name: 'client-test',
          arguments: {}
        }
      };

      const result = await getHandler(request);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'Found 1 projects'
          }
        ]
      });

      // Verify client was called
      expect(mockClient.findAll).toHaveBeenCalled();
      expect(clientTestHandler).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          client: mockClient
        })
      );
    });
  });
});