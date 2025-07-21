/**
 * Unit tests for HttpTransport
 */

import { jest } from '@jest/globals';
import { HttpTransport } from '../HttpTransport.js';

// Mock express and dependencies
const mockApp = {
  use: jest.fn(),
  get: jest.fn(),
  post: jest.fn(),
  listen: jest.fn(),
};

const mockHttpServer = {
  on: jest.fn(),
  close: jest.fn(),
};

jest.mock('express', () => {
  const express = jest.fn(() => mockApp);
  express.json = jest.fn(() => 'json-middleware');
  return express;
});

jest.mock('cors', () => jest.fn(() => 'cors-middleware'));

// Mock console.log to avoid cluttering test output
const originalConsoleLog = console.log;
beforeAll(() => {
  console.log = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
});

describe('HttpTransport', () => {
  let httpTransport;
  let mockServer;
  let mockOptions;

  beforeEach(() => {
    jest.clearAllMocks();

    mockServer = {
      connect: jest.fn(),
    };

    mockOptions = {
      port: 3457,
      toolDefinitions: [
        { name: 'tool1', description: 'Tool 1' },
        { name: 'tool2', description: 'Tool 2' },
      ],
      hulyClientWrapper: {
        withClient: jest.fn(),
      },
      services: {
        projectService: {
          listProjects: jest.fn(),
          createProject: jest.fn(),
        },
        issueService: {
          listIssues: jest.fn(),
          createIssue: jest.fn(),
        },
      },
    };

    // Setup mock listen to return mock server
    mockApp.listen.mockImplementation((port, callback) => {
      setTimeout(() => callback(), 0);
      return mockHttpServer;
    });

    httpTransport = new HttpTransport(mockServer, mockOptions);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided options', () => {
      expect(httpTransport.port).toBe(3457);
      expect(httpTransport.toolDefinitions).toEqual(mockOptions.toolDefinitions);
      expect(httpTransport.services).toBe(mockOptions.services);
      expect(httpTransport.running).toBe(false);
    });

    it('should use default port if not provided', () => {
      const transport = new HttpTransport(mockServer);
      expect(transport.port).toBe(3000);
    });

    it('should use PORT env variable if set', () => {
      process.env.PORT = '8080';
      const transport = new HttpTransport(mockServer);
      expect(transport.port).toBe('8080');
      delete process.env.PORT;
    });
  });

  describe('start', () => {
    it('should start HTTP server successfully', async () => {
      await httpTransport.start();

      expect(mockApp.use).toHaveBeenCalledWith('cors-middleware');
      expect(mockApp.use).toHaveBeenCalledWith('json-middleware');
      expect(mockApp.listen).toHaveBeenCalledWith(3457, expect.any(Function));
      expect(httpTransport.running).toBe(true);
    });

    it('should throw error if already running', async () => {
      await httpTransport.start();

      await expect(httpTransport.start()).rejects.toThrow('HTTP transport is already running');
    });

    it('should handle server startup error', async () => {
      mockApp.listen.mockImplementation((_port, _callback) => {
        const server = mockHttpServer;
        // Simulate error after returning server
        setTimeout(() => {
          const errorCallback = mockHttpServer.on.mock.calls.find(
            (call) => call[0] === 'error'
          )?.[1];
          if (errorCallback) {
            errorCallback(new Error('EADDRINUSE'));
          }
        }, 0);
        return server;
      });

      const startPromise = httpTransport.start();

      // Wait a bit for the error to be triggered
      await new Promise((resolve) => setTimeout(resolve, 10));

      await expect(startPromise).rejects.toThrow('Failed to start HTTP transport');
      expect(httpTransport.running).toBe(false);
    });
  });

  describe('stop', () => {
    it('should stop server successfully', async () => {
      await httpTransport.start();

      mockHttpServer.close.mockImplementation((callback) => {
        callback();
      });

      await httpTransport.stop();

      expect(mockHttpServer.close).toHaveBeenCalled();
      expect(httpTransport.running).toBe(false);
      expect(httpTransport.httpServer).toBeNull();
    });

    it('should do nothing if not running', async () => {
      await httpTransport.stop();

      expect(mockHttpServer.close).not.toHaveBeenCalled();
    });

    it('should handle close error', async () => {
      await httpTransport.start();

      mockHttpServer.close.mockImplementation((callback) => {
        callback(new Error('Close failed'));
      });

      await expect(httpTransport.stop()).rejects.toThrow('Failed to stop HTTP transport');
    });
  });

  describe('routes', () => {
    let routes;

    beforeEach(async () => {
      await httpTransport.start();

      // Capture registered routes
      routes = {
        get: {},
        post: {},
      };

      mockApp.get.mock.calls.forEach(([path, handler]) => {
        routes.get[path] = handler;
      });

      mockApp.post.mock.calls.forEach(([path, handler]) => {
        routes.post[path] = handler;
      });
    });

    describe('/health endpoint', () => {
      it('should return health status', () => {
        const mockReq = {};
        const mockRes = {
          json: jest.fn(),
        };

        routes.get['/health'](mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith({
          status: 'healthy',
          server: 'huly-mcp-server',
          transport: 'http',
          uptime: expect.any(Number),
        });
      });
    });

    describe('/tools endpoint', () => {
      it('should return tool definitions', () => {
        const mockReq = {};
        const mockRes = {
          json: jest.fn(),
        };

        routes.get['/tools'](mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith({
          tools: mockOptions.toolDefinitions,
        });
      });
    });

    describe('/mcp endpoint', () => {
      it('should handle initialize method', async () => {
        const mockReq = {
          body: {
            jsonrpc: '2.0',
            method: 'initialize',
            params: {},
            id: 1,
          },
        };
        const mockRes = {
          json: jest.fn(),
          status: jest.fn(() => mockRes),
        };

        await routes.post['/mcp'](mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith({
          jsonrpc: '2.0',
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: 'huly-mcp-server',
              version: '1.0.0',
            },
          },
          id: 1,
        });
      });

      it('should handle tools/list method', async () => {
        const mockReq = {
          body: {
            jsonrpc: '2.0',
            method: 'tools/list',
            params: {},
            id: 2,
          },
        };
        const mockRes = {
          json: jest.fn(),
          status: jest.fn(() => mockRes),
        };

        await routes.post['/mcp'](mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith({
          jsonrpc: '2.0',
          result: {
            tools: mockOptions.toolDefinitions,
          },
          id: 2,
        });
      });

      it('should handle tools/call method', async () => {
        const mockResult = {
          content: [{ type: 'text', text: 'Projects listed' }],
        };

        mockOptions.hulyClientWrapper.withClient.mockImplementation(async (fn) => {
          return fn({});
        });

        mockOptions.services.projectService.listProjects.mockResolvedValue(mockResult);

        const mockReq = {
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
        const mockRes = {
          json: jest.fn(),
          status: jest.fn(() => mockRes),
        };

        await routes.post['/mcp'](mockReq, mockRes);

        expect(mockOptions.hulyClientWrapper.withClient).toHaveBeenCalled();
        expect(mockRes.json).toHaveBeenCalledWith({
          jsonrpc: '2.0',
          result: mockResult,
          id: 3,
        });
      });

      it('should handle invalid JSON-RPC request', async () => {
        const mockReq = {
          body: {
            invalid: 'request',
          },
        };
        const mockRes = {
          json: jest.fn(),
          status: jest.fn(() => mockRes),
        };

        await routes.post['/mcp'](mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          jsonrpc: '2.0',
          error: { code: -32600, message: 'Invalid Request' },
          id: null,
        });
      });

      it('should handle unknown method', async () => {
        const mockReq = {
          body: {
            jsonrpc: '2.0',
            method: 'unknown/method',
            params: {},
            id: 4,
          },
        };
        const mockRes = {
          json: jest.fn(),
          status: jest.fn(() => mockRes),
        };

        await routes.post['/mcp'](mockReq, mockRes);

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
    });

    describe('/tools/:toolName endpoint', () => {
      it('should execute tool directly', async () => {
        const mockResult = {
          content: [{ type: 'text', text: 'Tool executed' }],
        };

        mockOptions.hulyClientWrapper.withClient.mockImplementation(async (fn) => {
          return fn({});
        });

        mockOptions.services.projectService.listProjects.mockResolvedValue(mockResult);

        const mockReq = {
          params: { toolName: 'huly_list_projects' },
          body: {},
        };
        const mockRes = {
          json: jest.fn(),
          status: jest.fn(() => mockRes),
        };

        await routes.post['/tools/:toolName'](mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith(mockResult);
      });

      it('should handle tool execution error', async () => {
        mockOptions.hulyClientWrapper.withClient.mockRejectedValue(new Error('Execution failed'));

        const mockReq = {
          params: { toolName: 'huly_list_projects' },
          body: {},
        };
        const mockRes = {
          json: jest.fn(),
          status: jest.fn(() => mockRes),
        };

        await routes.post['/tools/:toolName'](mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Execution failed' },
          id: null,
        });
      });
    });
  });

  describe('executeTool', () => {
    beforeEach(async () => {
      await httpTransport.start();

      mockOptions.hulyClientWrapper.withClient.mockImplementation(async (fn) => {
        return fn({});
      });
    });

    it('should execute project tools', async () => {
      const mockResult = { content: [{ type: 'text', text: 'Success' }] };
      mockOptions.services.projectService.createProject.mockResolvedValue(mockResult);

      const result = await httpTransport.executeTool('huly_create_project', {
        name: 'Test Project',
        description: 'Test Description',
        identifier: 'TEST',
      });

      expect(mockOptions.services.projectService.createProject).toHaveBeenCalledWith(
        {},
        'Test Project',
        'Test Description',
        'TEST'
      );
      expect(result).toBe(mockResult);
    });

    it('should execute issue tools', async () => {
      const mockResult = { content: [{ type: 'text', text: 'Issue created' }] };
      mockOptions.services.issueService.createIssue.mockResolvedValue(mockResult);

      const result = await httpTransport.executeTool('huly_create_issue', {
        project_identifier: 'TEST',
        title: 'Test Issue',
        description: 'Test Description',
        priority: 'high',
      });

      expect(mockOptions.services.issueService.createIssue).toHaveBeenCalledWith(
        {},
        'TEST',
        'Test Issue',
        'Test Description',
        'high'
      );
      expect(result).toBe(mockResult);
    });

    it('should throw error for unknown tool', async () => {
      await expect(httpTransport.executeTool('unknown_tool', {})).rejects.toThrow();
    });
  });

  describe('handleError', () => {
    let mockRes;

    beforeEach(() => {
      mockRes = {
        status: jest.fn(() => mockRes),
        json: jest.fn(),
      };
    });

    it('should handle HulyError', () => {
      const error = {
        code: 'TEST_ERROR',
        message: 'Test error message',
        details: { extra: 'info' },
      };

      // Mock HulyError instance
      Object.setPrototypeOf(error, Error.prototype);
      error.constructor = { name: 'HulyError' };

      httpTransport.handleError(mockRes, error, 123);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Test error message',
          data: {
            errorCode: 'TEST_ERROR',
            details: { extra: 'info' },
          },
        },
        id: 123,
      });
    });

    it('should handle regular errors', () => {
      const error = new Error('Regular error');

      httpTransport.handleError(mockRes, error);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Regular error' },
        id: null,
      });
    });
  });

  describe('getType', () => {
    it('should return transport type', () => {
      expect(httpTransport.getType()).toBe('http');
    });
  });

  describe('isRunning', () => {
    it('should return false when not started', () => {
      expect(httpTransport.isRunning()).toBe(false);
    });

    it('should return true when running', async () => {
      await httpTransport.start();
      expect(httpTransport.isRunning()).toBe(true);
    });

    it('should return false after stopped', async () => {
      await httpTransport.start();
      mockHttpServer.close.mockImplementation((callback) => callback());
      await httpTransport.stop();
      expect(httpTransport.isRunning()).toBe(false);
    });
  });
});
