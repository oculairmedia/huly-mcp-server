/**
 * HttpTransport REST API Tests
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

const mockRouter = {
  use: jest.fn(),
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
};

const mockExpress = jest.fn();
mockExpress.Router = jest.fn(() => mockRouter);
mockExpress.json = jest.fn(() => (req, res, next) => next());

const mockExpressApp = {
  use: jest.fn(),
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
  listen: jest.fn(),
};

const mockCors = jest.fn(() => (req, res, next) => next());

await jest.unstable_mockModule('express', () => ({
  default: mockExpress,
}));

await jest.unstable_mockModule('cors', () => ({
  default: mockCors,
}));

const { HttpTransport } = await import('../../../src/transport/HttpTransport.js');
const { HulyError } = await import('../../../src/core/HulyError.js');

describe('HttpTransport REST API', () => {
  let transport;
  let mockHttpServer;
  let logger;
  const port = 3457;
  const toolDefinitions = [
    {
      name: 'huly_list_projects',
      description: 'List projects',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'huly_create_issue',
      description: 'Create issue',
      inputSchema: {
        type: 'object',
        properties: {
          project_identifier: { type: 'string' },
        },
        required: ['project_identifier', 'title'],
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      child: jest.fn(() => logger),
    };

    mockHttpServer = {
      close: jest.fn((callback) => callback()),
      on: jest.fn(),
    };

    mockExpressApp.use.mockReturnThis();
    mockExpressApp.get.mockReturnThis();
    mockExpressApp.post.mockReturnThis();
    mockExpressApp.delete.mockReturnThis();
    mockExpressApp.listen.mockImplementation((listenPort, hostOrCallback, maybeCallback) => {
      const callback = typeof hostOrCallback === 'function' ? hostOrCallback : maybeCallback;
      if (callback) {
        callback();
      }
      return mockHttpServer;
    });

    mockExpress.mockReturnValue(mockExpressApp);
    mockExpress.json = jest.fn(() => (req, res, next) => next());
    mockExpress.urlencoded = jest.fn(() => (req, res, next) => next());

    process.env.HULY_EMAIL = process.env.HULY_EMAIL || 'rest-test@example.com';
    process.env.HULY_PASSWORD = process.env.HULY_PASSWORD || 'secret';
    process.env.HULY_WORKSPACE = process.env.HULY_WORKSPACE || 'workspace';

    transport = new HttpTransport({}, {
      port,
      toolDefinitions,
      hulyClientWrapper: { withClient: jest.fn() },
      services: {},
      logger,
    });
  });

  afterEach(async () => {
    if (transport?.isRunning()) {
      await transport.stop();
    }
  });

  test('GET /tools returns tool metadata and count', async () => {
    await transport.start();

    const route = mockExpressApp.get.mock.calls.find((call) => call[0] === '/tools')?.[1];
    expect(route).toBeDefined();

    const res = { json: jest.fn() };
    route({}, res);

    expect(res.json).toHaveBeenCalledWith({
      tools: toolDefinitions.map(({ name, description, inputSchema }) => ({
        name,
        description,
        inputSchema,
      })),
      count: toolDefinitions.length,
    });
  });

  test('POST /tools/:toolName executes tool and returns result', async () => {
    await transport.start();

    const executeSpy = jest
      .spyOn(transport, 'executeTool')
      .mockResolvedValue({ id: 'ISSUE-1' });

    const route = mockExpressApp.post.mock.calls.find((call) => call[0] === '/tools/:toolName')?.[1];
    expect(route).toBeDefined();

    const req = {
      params: { toolName: 'huly_create_issue' },
      body: { project_identifier: 'HULLY', title: 'REST test' },
    };
    const res = { json: jest.fn(() => res), status: jest.fn(() => res) };

    await route(req, res);

    expect(executeSpy).toHaveBeenCalledWith('huly_create_issue', req.body);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      result: { id: 'ISSUE-1' },
      tool: 'huly_create_issue',
      timestamp: expect.any(String),
    });

    executeSpy.mockRestore();
  });

  test('POST /tools/:toolName maps HulyError to HTTP 400', async () => {
    await transport.start();

    const error = HulyError.invalidValue('tool', 'invalid_tool', 'valid tool name');
    const executeSpy = jest
      .spyOn(transport, 'executeTool')
      .mockRejectedValue(error);

    const route = mockExpressApp.post.mock.calls.find((call) => call[0] === '/tools/:toolName')?.[1];
    const req = { params: { toolName: 'invalid_tool' }, body: {} };
    const res = { json: jest.fn(() => res), status: jest.fn(() => res) };

    await route(req, res);

    expect(executeSpy).toHaveBeenCalledWith('invalid_tool', req.body);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      jsonrpc: '2.0',
      error: {
        code: -32602,
        message: error.message,
        data: {
          code: error.code,
          details: error.details,
        },
      },
      id: null,
    });

    executeSpy.mockRestore();
  });
});
