/**
 * Simple integration tests for MCP prompt protocol support
 * Tests the actual prompt execution flow without complex mocking
 */

import { jest } from '@jest/globals';
import { Server as _Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport as _StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { MCPHandler } from '../../src/protocol/MCPHandler.js';
import { promptRegistry, registerPrompt } from '../../src/prompts/base/PromptRegistry.js';

// Mock only external dependencies that would cause initialization issues
jest.mock('../../src/config/index.js', () => ({
  getConfigManager: () => ({
    getHulyConfig: () => ({
      workspace: 'test',
      email: 'test@example.com',
      password: 'test'
    })
  })
}));

jest.mock('../../src/utils/index.js', () => ({
  createLoggerWithConfig: () => ({
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: (_name) => ({
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      child: jest.fn(() => ({ info: jest.fn(), error: jest.fn(), debug: jest.fn() }))
    })
  })
}));

jest.mock('../../src/tools/index.js', () => ({
  initializeTools: jest.fn(() => Promise.resolve()),
  getAllToolDefinitions: jest.fn(() => []),
  executeTool: jest.fn(),
  hasTool: jest.fn(() => false)
}));

describe('MCP Prompt Protocol Simple Integration', () => {
  let handler;
  let mockServer;
  let mockServices;

  beforeEach(() => {
    // Clear the prompt registry
    promptRegistry.clear();

    // Create a simple mock server that captures handlers
    const handlers = new Map();
    mockServer = {
      setRequestHandler: jest.fn((schema, handlerFn) => {
        handlers.set(schema.method || 'unknown', handlerFn);
      }),
      getHandler: (method) => handlers.get(method)
    };

    // Mock services
    const mockClient = {
      findAll: jest.fn(() => Promise.resolve([])),
      createDoc: jest.fn(() => Promise.resolve({ _id: 'test-id' }))
    };

    mockServices = {
      hulyClientWrapper: {
        withClient: jest.fn((callback) => callback(mockClient))
      }
    };

    // Create handler
    handler = new MCPHandler(mockServer, mockServices);
  });

  afterEach(() => {
    promptRegistry.clear();
  });

  describe('Basic Prompt Flow', () => {
    it('should initialize without errors', async () => {
      await expect(handler.initialize()).resolves.not.toThrow();
    });

    it('should register MCP request handlers', () => {
      expect(mockServer.setRequestHandler).toHaveBeenCalledTimes(4); // tools/list, tools/call, prompts/list, prompts/get
    });

    it('should handle empty prompts list', async () => {
      await handler.initialize();

      // Find the prompts/list handler by inspecting call arguments
      const listPromptsCall = mockServer.setRequestHandler.mock.calls
        .find(call => call[0].method === 'prompts/list' || call[1].toString().includes('getAllPromptDefinitions'));

      expect(listPromptsCall).toBeDefined();

      const [_schema, handlerFn] = listPromptsCall;
      const result = await handlerFn();

      expect(result).toEqual({
        prompts: []
      });
    });
  });

  describe('Prompt Execution Flow', () => {
    it('should execute a registered prompt successfully', async () => {
      // Register a test prompt
      const testHandler = jest.fn(async (args, context) => {
        expect(context).toHaveProperty('client');
        expect(context).toHaveProperty('services');
        expect(context).toHaveProperty('config');

        return {
          content: [
            {
              type: 'text',
              text: `Hello ${args.name || 'world'}!`
            }
          ]
        };
      });

      registerPrompt({
        name: 'hello-prompt',
        description: 'A simple greeting prompt',
        handler: testHandler,
        arguments: [
          { name: 'name', description: 'Name to greet', required: false }
        ]
      });

      await handler.initialize();

      // Find the prompts/list handler and verify the prompt is listed
      const listPromptsCall = mockServer.setRequestHandler.mock.calls
        .find(call => call[1].toString().includes('getAllPromptDefinitions'));

      const [, listHandler] = listPromptsCall;
      const listResult = await listHandler();

      expect(listResult.prompts).toHaveLength(1);
      expect(listResult.prompts[0]).toEqual({
        name: 'hello-prompt',
        description: 'A simple greeting prompt',
        arguments: [
          { name: 'name', description: 'Name to greet', required: false }
        ]
      });

      // Find the prompts/get handler and execute the prompt
      const getPromptsCall = mockServer.setRequestHandler.mock.calls
        .find(call => call[1].toString().includes('executePrompt'));

      const [, getHandler] = getPromptsCall;
      const getResult = await getHandler({
        params: {
          name: 'hello-prompt',
          arguments: { name: 'Alice' }
        }
      });

      expect(getResult).toEqual({
        content: [
          {
            type: 'text',
            text: 'Hello Alice!'
          }
        ]
      });

      expect(testHandler).toHaveBeenCalledWith(
        { name: 'Alice' },
        expect.objectContaining({
          client: expect.any(Object),
          services: mockServices,
          config: expect.any(Object)
        })
      );
    });

    it('should handle non-existent prompt gracefully', async () => {
      await handler.initialize();

      const getPromptsCall = mockServer.setRequestHandler.mock.calls
        .find(call => call[1].toString().includes('executePrompt'));

      const [, getHandler] = getPromptsCall;
      const result = await getHandler({
        params: {
          name: 'non-existent-prompt',
          arguments: {}
        }
      });

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

    it('should handle prompt execution errors', async () => {
      // Register a prompt that throws an error
      registerPrompt({
        name: 'error-prompt',
        description: 'A prompt that throws an error',
        handler: jest.fn(async () => {
          throw new Error('Test error');
        })
      });

      await handler.initialize();

      const getPromptsCall = mockServer.setRequestHandler.mock.calls
        .find(call => call[1].toString().includes('executePrompt'));

      const [, getHandler] = getPromptsCall;
      const result = await getHandler({
        params: {
          name: 'error-prompt',
          arguments: {}
        }
      });

      expect(result).toHaveProperty('content');
      expect(result.content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('Test error')
          })
        ])
      );
    });
  });

  describe('Client Integration', () => {
    it('should provide Huly client to prompt handlers', async () => {
      const mockClient = {
        findAll: jest.fn(() => Promise.resolve([{ name: 'test-project' }])),
        createDoc: jest.fn(() => Promise.resolve({ _id: 'new-id' }))
      };

      mockServices.hulyClientWrapper.withClient = jest.fn((callback) => callback(mockClient));

      const clientTestHandler = jest.fn(async (args, context) => {
        // Use the client
        const result = await context.client.findAll();
        return {
          content: [
            {
              type: 'text',
              text: `Found ${result.length} items`
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

      const getPromptsCall = mockServer.setRequestHandler.mock.calls
        .find(call => call[1].toString().includes('executePrompt'));

      const [, getHandler] = getPromptsCall;
      const result = await getHandler({
        params: {
          name: 'client-test',
          arguments: {}
        }
      });

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'Found 1 items'
          }
        ]
      });

      expect(mockClient.findAll).toHaveBeenCalled();
      expect(mockServices.hulyClientWrapper.withClient).toHaveBeenCalled();
    });
  });
});