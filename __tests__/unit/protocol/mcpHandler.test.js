/**
 * MCPHandler Tests
 *
 * Tests for the MCP protocol handler
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// Set up environment variables before any imports
process.env.HULY_EMAIL = 'test@example.com';
process.env.HULY_PASSWORD = 'test-password';
process.env.HULY_WORKSPACE = 'test-workspace';

// Mock dependencies before importing MCPHandler
const mockInitializeTools = jest.fn();
const mockGetAllToolDefinitions = jest.fn();
const mockExecuteTool = jest.fn();
const mockHasTool = jest.fn();

jest.unstable_mockModule('../../../src/tools/index.js', () => ({
  initializeTools: mockInitializeTools,
  getAllToolDefinitions: mockGetAllToolDefinitions,
  executeTool: mockExecuteTool,
  hasTool: mockHasTool,
}));

const mockGetConfigManager = jest.fn();
jest.unstable_mockModule('../../../src/config/index.js', () => ({
  getConfigManager: mockGetConfigManager,
}));

const mockCreateLoggerWithConfig = jest.fn();
jest.unstable_mockModule('../../../src/utils/index.js', () => ({
  createLoggerWithConfig: mockCreateLoggerWithConfig,
}));

// Import modules after mocks are set up
const { MCPHandler } = await import('../../../src/protocol/MCPHandler.js');
const { HulyError } = await import('../../../src/core/HulyError.js');

describe('MCPHandler Tests', () => {
  let _handler;
  let mockServer;
  let mockServices;
  let mockClient;
  let mockLogger;
  let mockConfig;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Set up mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      child: jest.fn(() => mockLogger),
    };

    // Set up mock config
    mockConfig = {
      email: 'test@example.com',
      password: 'test-password',
      workspace: 'test-workspace',
      url: 'https://test.huly.io',
    };

    // Configure mocks
    mockCreateLoggerWithConfig.mockReturnValue(mockLogger);
    mockGetConfigManager.mockReturnValue({
      getHulyConfig: () => mockConfig,
    });

    // Reset tool mocks
    mockInitializeTools.mockResolvedValue(undefined);
    mockGetAllToolDefinitions.mockReturnValue([
      {
        name: 'huly_list_projects',
        description: 'List all projects',
        inputSchema: { type: 'object', properties: {}, required: [] },
      },
      {
        name: 'huly_create_issue',
        description: 'Create a new issue',
        inputSchema: {
          type: 'object',
          properties: {
            project_identifier: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            priority: { type: 'string' },
          },
          required: ['project_identifier', 'title'],
        },
      },
    ]);

    // Create mock server
    mockServer = {
      setRequestHandler: jest.fn(),
    };

    // Create mock client
    mockClient = {};

    // Create mock services
    mockServices = {
      projectService: {},
      issueService: {},
      hulyClientWrapper: {
        withClient: jest.fn(async (callback) => callback(mockClient)),
      },
    };

    // Create handler instance
    new MCPHandler(mockServer, mockServices);
  });

  describe('Constructor', () => {
    test('should set up request handlers', () => {
      expect(mockServer.setRequestHandler).toHaveBeenCalledTimes(2);
      expect(mockServer.setRequestHandler).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Function)
      );
    });
  });

  describe('Tool Listing', () => {
    test('should handle ListToolsRequestSchema', async () => {
      const listToolsHandler = mockServer.setRequestHandler.mock.calls[0][1];
      const result = await listToolsHandler();

      expect(mockInitializeTools).toHaveBeenCalled();
      expect(mockGetAllToolDefinitions).toHaveBeenCalled();
      expect(result).toHaveProperty('tools');
      expect(Array.isArray(result.tools)).toBe(true);
      expect(result.tools.length).toBe(2);
      expect(result.tools[0].name).toBe('huly_list_projects');
      expect(result.tools[1].name).toBe('huly_create_issue');
    });
  });

  describe('Tool Execution', () => {
    let toolHandler;

    beforeEach(() => {
      // Get the CallToolRequestSchema handler
      toolHandler = mockServer.setRequestHandler.mock.calls[1][1];
    });

    test('should execute project listing tool', async () => {
      mockHasTool.mockReturnValue(true);
      mockExecuteTool.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Projects listed' }],
      });

      const request = {
        params: {
          name: 'huly_list_projects',
          arguments: {},
        },
      };

      const result = await toolHandler(request);

      expect(mockInitializeTools).toHaveBeenCalled();
      expect(mockHasTool).toHaveBeenCalledWith('huly_list_projects');
      expect(mockServices.hulyClientWrapper.withClient).toHaveBeenCalled();
      expect(mockExecuteTool).toHaveBeenCalledWith(
        'huly_list_projects',
        {},
        expect.objectContaining({
          client: mockClient,
          services: mockServices,
          config: mockConfig,
          logger: expect.any(Object),
        })
      );
      expect(result.content[0].text).toBe('Projects listed');
    });

    test('should execute issue creation tool', async () => {
      mockHasTool.mockReturnValue(true);
      mockExecuteTool.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Issue created' }],
      });

      const request = {
        params: {
          name: 'huly_create_issue',
          arguments: {
            project_identifier: 'TEST',
            title: 'Test Issue',
            description: 'Test description',
            priority: 'high',
          },
        },
      };

      const result = await toolHandler(request);

      expect(mockHasTool).toHaveBeenCalledWith('huly_create_issue');
      expect(mockExecuteTool).toHaveBeenCalledWith(
        'huly_create_issue',
        {
          project_identifier: 'TEST',
          title: 'Test Issue',
          description: 'Test description',
          priority: 'high',
        },
        expect.objectContaining({
          client: mockClient,
          services: mockServices,
          config: mockConfig,
          logger: expect.any(Object),
        })
      );
      expect(result.content[0].text).toBe('Issue created');
    });

    test('should handle HulyError appropriately', async () => {
      const hulyError = new HulyError('NOT_FOUND', 'Project not found');
      mockHasTool.mockReturnValue(true);
      mockServices.hulyClientWrapper.withClient.mockRejectedValueOnce(hulyError);

      const request = {
        params: {
          name: 'huly_list_projects',
          arguments: {},
        },
      };

      const result = await toolHandler(request);

      expect(result).toHaveProperty('content');
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Project not found');
    });

    test('should handle generic errors', async () => {
      mockHasTool.mockReturnValue(true);
      mockServices.hulyClientWrapper.withClient.mockRejectedValueOnce(
        new Error('Connection failed')
      );

      const request = {
        params: {
          name: 'huly_list_projects',
          arguments: {},
        },
      };

      const result = await toolHandler(request);

      expect(result).toHaveProperty('content');
      expect(result.content[0].text).toBe('❌ Error: Connection failed');
    });

    test('should handle invalid tool name', async () => {
      mockHasTool.mockReturnValue(false);

      const request = {
        params: {
          name: 'invalid_tool',
          arguments: {},
        },
      };

      const result = await toolHandler(request);

      expect(mockHasTool).toHaveBeenCalledWith('invalid_tool');
      expect(result).toHaveProperty('content');
      expect(result.content[0].text).toContain("Invalid value for field 'tool'");
      expect(result.content[0].text).toContain('invalid_tool');
      expect(result.content[0].text).toContain('a valid tool name');
    });

    test('should handle executeTool errors from within withClient', async () => {
      mockHasTool.mockReturnValue(true);
      mockExecuteTool.mockRejectedValueOnce(new Error('Tool execution failed'));

      const request = {
        params: {
          name: 'huly_list_projects',
          arguments: {},
        },
      };

      const result = await toolHandler(request);

      expect(result).toHaveProperty('content');
      expect(result.content[0].text).toBe('❌ Error: Tool execution failed');
    });
  });

  describe('Initialize', () => {
    test('should initialize tools only once', async () => {
      const listToolsHandler = mockServer.setRequestHandler.mock.calls[0][1];

      // Call multiple times
      await listToolsHandler();
      await listToolsHandler();
      await listToolsHandler();

      // Should only initialize once
      expect(mockInitializeTools).toHaveBeenCalledTimes(1);
    });

    test('should handle initialization errors', async () => {
      mockInitializeTools.mockRejectedValueOnce(new Error('Init failed'));

      const listToolsHandler = mockServer.setRequestHandler.mock.calls[0][1];

      await expect(listToolsHandler()).rejects.toThrow('Init failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to initialize tool system:',
        expect.any(Error)
      );
    });
  });
});
