/**
 * HttpTransport Tests
 *
 * Tests for the HTTP transport implementation
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock dependencies
const mockExpress = jest.fn();
const mockExpressApp = {
  use: jest.fn(),
  get: jest.fn(),
  post: jest.fn(),
  listen: jest.fn(),
};

jest.unstable_mockModule('express', () => ({
  default: mockExpress,
}));

jest.unstable_mockModule('cors', () => ({
  default: jest.fn(() => (req, res, next) => next()),
}));

jest.unstable_mockModule('../../../src/core/index.js', () => {
  class MockHulyError extends Error {
    constructor(code, message, details) {
      super(message);
      this.code = code;
      this.details = details;
    }

    static invalidValue(field, value, expected) {
      const error = new MockHulyError(
        'INVALID_VALUE',
        `Invalid value for field '${field}': ${value}. Expected ${expected}`,
        { field, value, expected }
      );
      return error;
    }
  }

  return { HulyError: MockHulyError };
});

// Import after mocks are set up
const { HttpTransport } = await import('../../../src/transport/HttpTransport.js');

describe('HttpTransport Tests', () => {
  let transport;
  let mockServer;
  let mockHttpServer;
  let mockHulyClientWrapper;
  let mockServices;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock HTTP server
    mockHttpServer = {
      close: jest.fn((callback) => callback()),
      on: jest.fn(),
    };

    // Configure express mock
    mockExpressApp.use.mockReturnThis();
    mockExpressApp.get.mockReturnThis();
    mockExpressApp.post.mockReturnThis();
    mockExpressApp.listen.mockImplementation((port, callback) => {
      callback();
      return mockHttpServer;
    });
    mockExpress.mockReturnValue(mockExpressApp);
    mockExpress.json = jest.fn(() => (req, res, next) => next());

    // Mock services
    mockServices = {
      projectService: {
        listProjects: jest.fn().mockResolvedValue({ projects: [] }),
        createProject: jest.fn().mockResolvedValue({ id: 'proj-1' }),
        listComponents: jest.fn().mockResolvedValue({ components: [] }),
        createComponent: jest.fn().mockResolvedValue({ id: 'comp-1' }),
        listMilestones: jest.fn().mockResolvedValue({ milestones: [] }),
        createMilestone: jest.fn().mockResolvedValue({ id: 'mile-1' }),
        listGithubRepositories: jest.fn().mockResolvedValue({ repositories: [] }),
        assignRepositoryToProject: jest.fn().mockResolvedValue({ success: true }),
      },
      issueService: {
        listIssues: jest.fn().mockResolvedValue({ issues: [] }),
        createIssue: jest.fn().mockResolvedValue({ id: 'issue-1' }),
        updateIssue: jest.fn().mockResolvedValue({ success: true }),
        createSubissue: jest.fn().mockResolvedValue({ id: 'issue-2' }),
        searchIssues: jest.fn().mockResolvedValue({ issues: [] }),
        listComments: jest.fn().mockResolvedValue({ comments: [] }),
        createComment: jest.fn().mockResolvedValue({ id: 'comment-1' }),
        getIssueDetails: jest.fn().mockResolvedValue({ id: 'issue-1', title: 'Test' }),
      },
    };

    mockHulyClientWrapper = {
      withClient: jest.fn((callback) => callback({})),
    };

    // Mock server
    mockServer = {};

    // Create transport instance
    transport = new HttpTransport(mockServer, {
      port: 3457,
      toolDefinitions: [
        { name: 'huly_list_projects', description: 'List projects' },
        { name: 'huly_create_issue', description: 'Create issue' },
      ],
      hulyClientWrapper: mockHulyClientWrapper,
      services: mockServices,
    });
  });

  afterEach(async () => {
    if (transport.isRunning()) {
      await transport.stop();
    }
  });

  describe('Constructor', () => {
    test('should initialize with default options', () => {
      const defaultTransport = new HttpTransport(mockServer);
      expect(defaultTransport.port).toBe(3000);
      expect(defaultTransport.app).toBeNull();
      expect(defaultTransport.httpServer).toBeNull();
      expect(defaultTransport.running).toBe(false);
      expect(defaultTransport.toolDefinitions).toEqual([]);
    });

    test('should initialize with custom options', () => {
      expect(transport.port).toBe(3457);
      expect(transport.toolDefinitions).toHaveLength(2);
      expect(transport.hulyClientWrapper).toBe(mockHulyClientWrapper);
      expect(transport.services).toBe(mockServices);
    });

    test('should use PORT env variable if set', () => {
      process.env.PORT = '8080';
      const envTransport = new HttpTransport(mockServer);
      expect(envTransport.port).toBe('8080');
      delete process.env.PORT;
    });
  });

  describe('Start/Stop', () => {
    test('should start successfully', async () => {
      await transport.start();

      expect(transport.running).toBe(true);
      expect(mockExpress).toHaveBeenCalled();
      expect(mockExpressApp.use).toHaveBeenCalledTimes(2); // cors and json
      expect(mockExpressApp.listen).toHaveBeenCalledWith(3457, expect.any(Function));
      expect(mockHttpServer.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    test('should throw error if already running', async () => {
      await transport.start();

      await expect(transport.start()).rejects.toThrow('HTTP transport is already running');
    });

    test('should handle server startup errors', async () => {
      const startupError = new Error('Port already in use');
      mockExpressApp.listen.mockImplementationOnce((_port, _callback) => {
        const server = { ...mockHttpServer };
        // Simulate error event
        setTimeout(() => {
          const errorHandler = mockHttpServer.on.mock.calls.find(
            (call) => call[0] === 'error'
          )?.[1];
          if (errorHandler) {
            errorHandler(startupError);
          }
        }, 0);
        return server;
      });

      await expect(transport.start()).rejects.toThrow(
        'Failed to start HTTP transport: Port already in use'
      );
      expect(transport.running).toBe(false);
    });

    test('should stop successfully', async () => {
      await transport.start();
      await transport.stop();

      expect(transport.running).toBe(false);
      expect(transport.httpServer).toBeNull();
      expect(transport.app).toBeNull();
      expect(mockHttpServer.close).toHaveBeenCalled();
    });

    test('should handle stop when not running', async () => {
      await expect(transport.stop()).resolves.not.toThrow();
    });

    test('should handle stop errors', async () => {
      await transport.start();
      mockHttpServer.close.mockImplementationOnce((callback) => {
        callback(new Error('Close failed'));
      });

      await expect(transport.stop()).rejects.toThrow('Failed to stop HTTP transport: Close failed');
    });
  });

  describe('Transport Info', () => {
    test('should return correct type', () => {
      expect(transport.getType()).toBe('http');
    });

    test('should report running status', async () => {
      expect(transport.isRunning()).toBe(false);

      await transport.start();
      expect(transport.isRunning()).toBe(true);

      await transport.stop();
      expect(transport.isRunning()).toBe(false);
    });
  });

  describe('Routes Setup', () => {
    test('should set up all routes', async () => {
      await transport.start();

      // Check route registrations
      const getCalls = mockExpressApp.get.mock.calls;
      const postCalls = mockExpressApp.post.mock.calls;

      // Health check
      expect(getCalls.some((call) => call[0] === '/health')).toBe(true);
      expect(getCalls.some((call) => call[0] === '/tools')).toBe(true);

      // MCP endpoints
      expect(postCalls.some((call) => call[0] === '/mcp')).toBe(true);
      expect(postCalls.some((call) => call[0] === '/tools/:toolName')).toBe(true);
    });
  });

  describe('Health Check', () => {
    test('should respond with health status', async () => {
      await transport.start();

      const healthHandler = mockExpressApp.get.mock.calls.find(
        (call) => call[0] === '/health'
      )?.[1];

      const mockReq = {};
      const mockRes = {
        json: jest.fn(),
      };

      healthHandler(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'healthy',
        server: 'huly-mcp-server',
        transport: 'http',
        uptime: expect.any(Number),
      });
    });
  });

  describe('MCP JSON-RPC Endpoint', () => {
    let mcpHandler;
    let mockReq;
    let mockRes;

    beforeEach(async () => {
      await transport.start();

      mcpHandler = mockExpressApp.post.mock.calls.find((call) => call[0] === '/mcp')?.[1];

      mockRes = {
        json: jest.fn(),
        status: jest.fn(() => mockRes),
      };
    });

    test('should handle initialize method', async () => {
      mockReq = {
        body: {
          jsonrpc: '2.0',
          method: 'initialize',
          params: {},
          id: 1,
        },
      };

      await mcpHandler(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'huly-mcp-server', version: '1.0.0' },
        },
        id: 1,
      });
    });

    test('should handle tools/list method', async () => {
      mockReq = {
        body: {
          jsonrpc: '2.0',
          method: 'tools/list',
          params: {},
          id: 2,
        },
      };

      await mcpHandler(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        result: {
          tools: transport.toolDefinitions,
        },
        id: 2,
      });
    });

    test('should handle tools/call method', async () => {
      mockReq = {
        body: {
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'huly_list_projects',
            arguments: {},
          },
          id: 3,
        },
      };

      await mcpHandler(mockReq, mockRes);

      expect(mockHulyClientWrapper.withClient).toHaveBeenCalled();
      expect(mockServices.projectService.listProjects).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        result: { projects: [] },
        id: 3,
      });
    });

    test('should handle invalid JSON-RPC request', async () => {
      mockReq = {
        body: {
          method: 'test',
          // Missing jsonrpc field
        },
      };

      await mcpHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Invalid Request' },
        id: null,
      });
    });

    test('should handle unknown method', async () => {
      mockReq = {
        body: {
          jsonrpc: '2.0',
          method: 'unknown/method',
          params: {},
          id: 4,
        },
      };

      await mcpHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: 'Method not found',
          data: { method: 'unknown/method' },
        },
        id: 4,
      });
    });

    test('should handle errors during method execution', async () => {
      mockReq = {
        body: {
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'huly_list_projects',
            arguments: {},
          },
          id: 5,
        },
      };

      mockHulyClientWrapper.withClient.mockImplementationOnce(() => {
        throw new Error('Connection failed');
      });

      await mcpHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Connection failed' },
        id: 5,
      });
    });
  });

  describe('REST Endpoints', () => {
    test('should handle GET /tools', async () => {
      await transport.start();

      const toolsHandler = mockExpressApp.get.mock.calls.find((call) => call[0] === '/tools')?.[1];

      const mockRes = {
        json: jest.fn(),
      };

      toolsHandler({}, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        tools: transport.toolDefinitions,
      });
    });

    test('should handle POST /tools/:toolName', async () => {
      await transport.start();

      const toolExecHandler = mockExpressApp.post.mock.calls.find(
        (call) => call[0] === '/tools/:toolName'
      )?.[1];

      const mockReq = {
        params: { toolName: 'huly_create_issue' },
        body: {
          project_identifier: 'PROJ',
          title: 'Test Issue',
          description: 'Test',
          priority: 'high',
        },
      };

      const mockRes = {
        json: jest.fn(),
        status: jest.fn(() => mockRes),
      };

      await toolExecHandler(mockReq, mockRes);

      expect(mockHulyClientWrapper.withClient).toHaveBeenCalled();
      expect(mockServices.issueService.createIssue).toHaveBeenCalledWith(
        {},
        'PROJ',
        'Test Issue',
        'Test',
        'high'
      );
      expect(mockRes.json).toHaveBeenCalledWith({ id: 'issue-1' });
    });

    test('should handle errors in REST tool execution', async () => {
      await transport.start();

      const toolExecHandler = mockExpressApp.post.mock.calls.find(
        (call) => call[0] === '/tools/:toolName'
      )?.[1];

      const mockReq = {
        params: { toolName: 'invalid_tool' },
        body: {},
      };

      const mockRes = {
        json: jest.fn(),
        status: jest.fn(() => mockRes),
      };

      // Mock withClient to throw an error for invalid tool
      mockHulyClientWrapper.withClient.mockImplementationOnce(async () => {
        const { HulyError } = await import('../../../src/core/index.js');
        throw HulyError.invalidValue('tool', 'invalid_tool', 'a valid tool name');
      });

      await toolExecHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        error: expect.objectContaining({
          code: -32000,
          message: expect.stringContaining('Invalid value'),
        }),
        id: null,
      });
    });
  });

  describe('Tool Execution', () => {
    test('should execute project tools', async () => {
      const tools = [
        { name: 'huly_list_projects', service: 'projectService', method: 'listProjects', args: {} },
        {
          name: 'huly_create_project',
          service: 'projectService',
          method: 'createProject',
          args: { name: 'Test', description: 'Desc', identifier: 'TEST' },
        },
        {
          name: 'huly_list_components',
          service: 'projectService',
          method: 'listComponents',
          args: { project_identifier: 'PROJ' },
        },
        {
          name: 'huly_create_component',
          service: 'projectService',
          method: 'createComponent',
          args: { project_identifier: 'PROJ', label: 'Comp', description: 'Desc' },
        },
        {
          name: 'huly_list_milestones',
          service: 'projectService',
          method: 'listMilestones',
          args: { project_identifier: 'PROJ' },
        },
        {
          name: 'huly_create_milestone',
          service: 'projectService',
          method: 'createMilestone',
          args: {
            project_identifier: 'PROJ',
            label: 'v1.0',
            description: 'Desc',
            target_date: '2024-12-31',
            status: 'planned',
          },
        },
        {
          name: 'huly_list_github_repositories',
          service: 'projectService',
          method: 'listGithubRepositories',
          args: {},
        },
        {
          name: 'huly_assign_repository_to_project',
          service: 'projectService',
          method: 'assignRepositoryToProject',
          args: { project_identifier: 'PROJ', repository_name: 'org/repo' },
        },
      ];

      for (const tool of tools) {
        const result = await transport.executeTool(tool.name, tool.args);
        expect(mockServices[tool.service][tool.method]).toHaveBeenCalled();
        expect(result).toBeDefined();
      }
    });

    test('should execute issue tools', async () => {
      const tools = [
        {
          name: 'huly_list_issues',
          service: 'issueService',
          method: 'listIssues',
          args: { project_identifier: 'PROJ', limit: 50 },
        },
        {
          name: 'huly_create_issue',
          service: 'issueService',
          method: 'createIssue',
          args: {
            project_identifier: 'PROJ',
            title: 'Issue',
            description: 'Desc',
            priority: 'medium',
          },
        },
        {
          name: 'huly_update_issue',
          service: 'issueService',
          method: 'updateIssue',
          args: { issue_identifier: 'PROJ-1', field: 'status', value: 'done' },
        },
        {
          name: 'huly_create_subissue',
          service: 'issueService',
          method: 'createSubissue',
          args: {
            parent_issue_identifier: 'PROJ-1',
            title: 'Sub',
            description: 'Desc',
            priority: 'low',
          },
        },
        {
          name: 'huly_search_issues',
          service: 'issueService',
          method: 'searchIssues',
          args: { query: 'test' },
        },
        {
          name: 'huly_list_comments',
          service: 'issueService',
          method: 'listComments',
          args: { issue_identifier: 'PROJ-1', limit: 50 },
        },
        {
          name: 'huly_create_comment',
          service: 'issueService',
          method: 'createComment',
          args: { issue_identifier: 'PROJ-1', message: 'Comment' },
        },
        {
          name: 'huly_get_issue_details',
          service: 'issueService',
          method: 'getIssueDetails',
          args: { issue_identifier: 'PROJ-1' },
        },
      ];

      for (const tool of tools) {
        const result = await transport.executeTool(tool.name, tool.args);
        expect(mockServices[tool.service][tool.method]).toHaveBeenCalled();
        expect(result).toBeDefined();
      }
    });

    test('should throw error for unknown tool', async () => {
      await expect(transport.executeTool('unknown_tool', {})).rejects.toThrow('Invalid value');
    });
  });

  describe('Error Handling', () => {
    test('should handle HulyError properly', async () => {
      const mockRes = {
        status: jest.fn(() => mockRes),
        json: jest.fn(),
      };

      // Import HulyError to create a proper instance
      const { HulyError } = await import('../../../src/core/index.js');
      const hulyError = new HulyError('TEST_ERROR', 'Test error', { field: 'test' });

      transport.handleError(mockRes, hulyError, 123);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Test error',
          data: {
            errorCode: 'TEST_ERROR',
            details: { field: 'test' },
          },
        },
        id: 123,
      });
    });

    test('should handle generic errors', () => {
      const mockRes = {
        status: jest.fn(() => mockRes),
        json: jest.fn(),
      };

      const error = new Error('Generic error');

      transport.handleError(mockRes, error);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Generic error' },
        id: null,
      });
    });
  });
});
