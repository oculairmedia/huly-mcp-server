/**
 * Unit tests for HttpTransport
 */

import { jest } from '@jest/globals';

// Create mocks that will be shared across tests
let _mockApp;
let _mockHttpServer;
let mockExpressFunc;
let mockExpressJson;

// Mock the modules before importing anything
jest.unstable_mockModule('express', () => {
  // Create the mock functions that will be reused
  mockExpressFunc = jest.fn();
  mockExpressJson = jest.fn(() => 'json-middleware');

  // Set up the default behavior
  mockExpressFunc.mockImplementation(() => {
    // Return a fresh app instance each time
    return {
      use: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      listen: jest.fn(() => ({
        on: jest.fn(),
        close: jest.fn((callback) => callback && callback()),
      })),
    };
  });

  // Add json as a property
  mockExpressFunc.json = mockExpressJson;

  return {
    default: mockExpressFunc,
    json: mockExpressJson,
  };
});

jest.unstable_mockModule('cors', () => ({
  default: jest.fn(() => 'cors-middleware'),
}));

// Import after mocking
const { HttpTransport } = await import('../HttpTransport.js');
const express = (await import('express')).default;
const _cors = (await import('cors')).default;

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
  let app;
  let httpServer;

  beforeEach(() => {
    jest.clearAllMocks();
    // Clean up environment variables that might affect port selection
    delete process.env.PORT;

    // Create a fresh app mock for this test
    app = {
      use: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      listen: jest.fn(),
    };

    // Create http server mock
    httpServer = {
      on: jest.fn(),
      close: jest.fn((_callback) => {
        if (_callback) _callback();
      }),
    };

    // Override express to return our app mock
    express.mockImplementation(() => app);

    // Ensure express.json is properly mocked
    express.json.mockReturnValue('json-middleware');

    // Setup app.listen to return httpServer
    app.listen.mockImplementation((_port, _callback) => {
      if (_callback) _callback();
      return httpServer;
    });

    mockServer = {
      connect: jest.fn(),
    };

    mockOptions = {
      port: 3000,
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

    httpTransport = new HttpTransport(mockServer, mockOptions);
  });

  afterEach(async () => {
    // Ensure transport is stopped and cleaned up
    if (httpTransport && httpTransport.running) {
      await httpTransport.stop();
    }
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided options', () => {
      expect(httpTransport.port).toBe(3000);
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

      expect(app.use).toHaveBeenCalledWith('cors-middleware');
      expect(app.use).toHaveBeenCalledWith('json-middleware');
      expect(app.listen).toHaveBeenCalledWith(3000, expect.any(Function));
      expect(httpTransport.running).toBe(true);
    });

    it('should throw error if already running', async () => {
      await httpTransport.start();

      await expect(httpTransport.start()).rejects.toThrow('HTTP transport is already running');
    });

    it('should handle server startup error', async () => {
      app.listen.mockImplementation((_port, _callback) => {
        // Don't call the callback - let the error handler reject the promise
        return httpServer;
      });

      // Start the server, which will return a promise
      const startPromise = httpTransport.start();

      // Trigger the error event after a small delay
      setTimeout(() => {
        const errorCallback = httpServer.on.mock.calls.find((call) => call[0] === 'error')?.[1];
        if (errorCallback) {
          errorCallback(new Error('EADDRINUSE'));
        }
      }, 0);

      // Wait for the promise to reject
      await expect(startPromise).rejects.toThrow('Failed to start HTTP transport');
      expect(httpTransport.running).toBe(false);
    });
  });

  describe('stop', () => {
    it('should stop server successfully', async () => {
      await httpTransport.start();

      httpServer.close.mockImplementation((callback) => {
        callback();
      });

      await httpTransport.stop();

      expect(httpServer.close).toHaveBeenCalled();
      expect(httpTransport.running).toBe(false);
      expect(httpTransport.httpServer).toBeNull();
    });

    it('should do nothing if not running', async () => {
      await httpTransport.stop();

      expect(httpServer.close).not.toHaveBeenCalled();
    });

    it('should handle close error', async () => {
      await httpTransport.start();

      // Get the actual httpServer instance that was created
      const actualHttpServer = httpTransport.httpServer;

      // Override the close method on the actual instance
      actualHttpServer.close = jest.fn((callback) => {
        callback(new Error('Close failed'));
      });

      await expect(httpTransport.stop()).rejects.toThrow('Failed to stop HTTP transport');

      // Clean up - mark as not running to prevent afterEach from trying to stop it again
      httpTransport.running = false;
      httpTransport.httpServer = null;
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

      app.get.mock.calls.forEach(([path, handler]) => {
        routes.get[path] = handler;
      });

      app.post.mock.calls.forEach(([path, handler]) => {
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
        const _mockResult = {
          content: [{ type: 'text', text: 'Projects listed' }],
        };

        mockOptions.hulyClientWrapper.withClient.mockImplementation(async (fn) => {
          return fn({});
        });

        mockOptions.services.projectService.listProjects.mockResolvedValue(_mockResult);

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
          result: _mockResult,
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
        const _mockResult = {
          content: [{ type: 'text', text: 'Tool executed' }],
        };

        mockOptions.hulyClientWrapper.withClient.mockImplementation(async (fn) => {
          return fn({});
        });

        mockOptions.services.projectService.listProjects.mockResolvedValue(_mockResult);

        const mockReq = {
          params: { toolName: 'huly_list_projects' },
          body: {},
        };
        const mockRes = {
          json: jest.fn(),
          status: jest.fn(() => mockRes),
        };

        await routes.post['/tools/:toolName'](mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith(_mockResult);
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
      const _mockResult = { content: [{ type: 'text', text: 'Success' }] };
      mockOptions.services.projectService.createProject.mockResolvedValue(_mockResult);

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
      expect(result).toBe(_mockResult);
    });

    it('should execute issue tools', async () => {
      const _mockResult = { content: [{ type: 'text', text: 'Issue created' }] };
      mockOptions.services.issueService.createIssue.mockResolvedValue(_mockResult);

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
      expect(result).toBe(_mockResult);
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

    it('should handle HulyError', async () => {
      // Import and create actual HulyError
      const { HulyError } = await import('../../core/index.js');
      const error = new HulyError('TEST_ERROR', 'Test error message', { extra: 'info' });

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
      httpServer.close.mockImplementation((callback) => callback());
      await httpTransport.stop();
      expect(httpTransport.isRunning()).toBe(false);
    });
  });
});
