/**
 * Unit tests for MCP prompt handling functionality
 */

import { jest } from '@jest/globals';
import { MCPHandler } from '../../../src/protocol/MCPHandler.js';
import * as promptsModule from '../../../src/prompts/index.js';
import * as toolsModule from '../../../src/tools/index.js';
import * as configModule from '../../../src/config/index.js';
import * as utilsModule from '../../../src/utils/index.js';
import { HulyError } from '../../../src/core/HulyError.js';

// Mock all external dependencies
jest.mock('../../../src/prompts/index.js');
jest.mock('../../../src/tools/index.js');
jest.mock('../../../src/config/index.js');
jest.mock('../../../src/utils/index.js');

describe('MCPHandler Prompt Support', () => {
  let handler;
  let mockServer;
  let mockServices;
  let mockLogger;
  let mockHulyClientWrapper;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      child: jest.fn(() => mockLogger)
    };

    // Mock config manager
    const mockConfigManager = {
      getHulyConfig: jest.fn(() => ({ workspace: 'test' }))
    };

    configModule.getConfigManager.mockReturnValue(mockConfigManager);
    utilsModule.createLoggerWithConfig.mockReturnValue(mockLogger);

    // Mock server with request handlers
    mockServer = {
      setRequestHandler: jest.fn(),
      handlers: new Map()
    };

    // Store handlers when they're registered
    mockServer.setRequestHandler.mockImplementation((schema, handler) => {
      mockServer.handlers.set(schema, handler);
    });

    // Mock huly client wrapper
    mockHulyClientWrapper = {
      withClient: jest.fn((callback) => {
        const mockClient = { test: 'client' };
        return callback(mockClient);
      })
    };

    mockServices = {
      hulyClientWrapper: mockHulyClientWrapper
    };

    // Mock prompt system functions
    jest.mocked(promptsModule.initializePrompts).mockResolvedValue();
    jest.mocked(promptsModule.getAllPromptDefinitions).mockReturnValue([
      {
        name: 'test-prompt',
        description: 'Test prompt',
        arguments: []
      }
    ]);
    jest.mocked(promptsModule.hasPrompt).mockReturnValue(true);
    jest.mocked(promptsModule.getPrompt).mockReturnValue({
      name: 'test-prompt',
      description: 'Test prompt'
    });
    jest.mocked(promptsModule.executePrompt).mockResolvedValue({
      content: [{ type: 'text', text: 'Test response' }]
    });

    // Mock tool system functions
    jest.mocked(toolsModule.initializeTools).mockResolvedValue();

    handler = new MCPHandler(mockServer, mockServices);
  });

  describe('Initialization', () => {
    it('should initialize prompts along with tools', async () => {
      await handler.initialize();

      expect(promptsModule.initializePrompts).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith('Tool and prompt systems initialized');
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Init failed');
      jest.mocked(promptsModule.initializePrompts).mockRejectedValue(error);

      await expect(handler.initialize()).rejects.toThrow('Init failed');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to initialize systems:', error);
    });
  });

  describe('ListPromptsRequest Handler', () => {
    it('should register list prompts handler', () => {
      // Handler should be registered during construction
      const _listPromptsSchema = { method: 'prompts/list' }; // Simplified for test
      expect(mockServer.setRequestHandler).toHaveBeenCalledWith(
        expect.objectContaining({}), // ListPromptsRequestSchema
        expect.any(Function)
      );
    });

    it('should return prompts list', async () => {
      const mockPrompts = [
        { name: 'prompt1', description: 'First prompt', arguments: [] },
        { name: 'prompt2', description: 'Second prompt', arguments: [] }
      ];

      jest.mocked(promptsModule.getAllPromptDefinitions).mockReturnValue(mockPrompts);

      // Find the list prompts handler
      const handlers = Array.from(mockServer.handlers.values());
      const listHandler = handlers.find(h => h.toString().includes('getAllPromptDefinitions'));

      expect(listHandler).toBeDefined();

      const result = await listHandler();

      expect(result).toEqual({
        prompts: mockPrompts
      });
      expect(promptsModule.getAllPromptDefinitions).toHaveBeenCalledTimes(1);
    });

    it('should handle list prompts errors', async () => {
      const error = new Error('Failed to get prompts');
      jest.mocked(promptsModule.getAllPromptDefinitions).mockImplementation(() => {
        throw error;
      });

      const handlers = Array.from(mockServer.handlers.values());
      const listHandler = handlers.find(h => h.toString().includes('getAllPromptDefinitions'));

      await expect(listHandler()).rejects.toThrow('Failed to get prompts');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to list prompts:', error);
    });
  });

  describe('GetPromptRequest Handler', () => {
    it('should register get prompt handler', () => {
      expect(mockServer.setRequestHandler).toHaveBeenCalledWith(
        expect.objectContaining({}), // GetPromptRequestSchema
        expect.any(Function)
      );
    });

    it('should execute prompt successfully', async () => {
      const mockRequest = {
        params: {
          name: 'test-prompt',
          arguments: { input: 'test' }
        }
      };

      const expectedResponse = {
        content: [{ type: 'text', text: 'Test response' }]
      };

      jest.mocked(promptsModule.executePrompt).mockResolvedValue(expectedResponse);

      // Find the get prompt handler
      const handlers = Array.from(mockServer.handlers.values());
      const getHandler = handlers.find(h => h.toString().includes('executePrompt'));

      expect(getHandler).toBeDefined();

      const result = await getHandler(mockRequest);

      expect(result).toEqual(expectedResponse);
      expect(promptsModule.hasPrompt).toHaveBeenCalledWith('test-prompt');
      expect(promptsModule.getPrompt).toHaveBeenCalledWith('test-prompt');
      expect(promptsModule.executePrompt).toHaveBeenCalledWith(
        'test-prompt',
        { input: 'test' },
        expect.objectContaining({
          client: { test: 'client' },
          services: mockServices,
          config: { workspace: 'test' },
          logger: mockLogger
        })
      );
    });

    it('should handle non-existent prompt', async () => {
      const mockRequest = {
        params: {
          name: 'non-existent',
          arguments: {}
        }
      };

      jest.mocked(promptsModule.hasPrompt).mockReturnValue(false);

      const handlers = Array.from(mockServer.handlers.values());
      const getHandler = handlers.find(h => h.toString().includes('executePrompt'));

      const result = await getHandler(mockRequest);

      // Should return HulyError response
      expect(result).toEqual(
        expect.objectContaining({
          content: expect.arrayContaining([
            expect.objectContaining({
              type: 'text',
              text: expect.stringContaining('not found')
            })
          ])
        })
      );
    });

    it('should handle prompt execution errors', async () => {
      const mockRequest = {
        params: {
          name: 'test-prompt',
          arguments: {}
        }
      };

      const error = new Error('Execution failed');
      jest.mocked(promptsModule.executePrompt).mockRejectedValue(error);

      const handlers = Array.from(mockServer.handlers.values());
      const getHandler = handlers.find(h => h.toString().includes('executePrompt'));

      const result = await getHandler(mockRequest);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: '❌ Prompt Error: Execution failed'
          }
        ]
      });
    });

    it('should handle HulyError instances', async () => {
      const mockRequest = {
        params: {
          name: 'test-prompt',
          arguments: {}
        }
      };

      const hulyError = HulyError.invalidValue('arg', 'value', 'expected');
      hulyError.toMCPResponse = jest.fn(() => ({
        content: [{ type: 'text', text: 'HulyError response' }]
      }));

      jest.mocked(promptsModule.executePrompt).mockRejectedValue(hulyError);

      const handlers = Array.from(mockServer.handlers.values());
      const getHandler = handlers.find(h => h.toString().includes('executePrompt'));

      const result = await getHandler(mockRequest);

      expect(hulyError.toMCPResponse).toHaveBeenCalled();
      expect(result).toEqual({
        content: [{ type: 'text', text: 'HulyError response' }]
      });
    });
  });

  describe('Client Integration', () => {
    it('should use client wrapper for prompt execution', async () => {
      const mockRequest = {
        params: {
          name: 'test-prompt',
          arguments: {}
        }
      };

      const handlers = Array.from(mockServer.handlers.values());
      const getHandler = handlers.find(h => h.toString().includes('executePrompt'));

      await getHandler(mockRequest);

      expect(mockHulyClientWrapper.withClient).toHaveBeenCalledTimes(1);
      expect(mockHulyClientWrapper.withClient).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should pass client to prompt execution context', async () => {
      const mockRequest = {
        params: {
          name: 'test-prompt',
          arguments: { test: 'arg' }
        }
      };

      const mockClient = { test: 'client' };
      mockHulyClientWrapper.withClient.mockImplementation((callback) => {
        return callback(mockClient);
      });

      const handlers = Array.from(mockServer.handlers.values());
      const getHandler = handlers.find(h => h.toString().includes('executePrompt'));

      await getHandler(mockRequest);

      expect(promptsModule.executePrompt).toHaveBeenCalledWith(
        'test-prompt',
        { test: 'arg' },
        expect.objectContaining({
          client: mockClient
        })
      );
    });
  });
});