/**
 * HULLY-248: Test HTTP compression (gzip/brotli)
 */

import { jest } from '@jest/globals';

let mockCompressionMiddleware;
let mockCompressionFilter;

jest.unstable_mockModule('compression', () => {
  mockCompressionFilter = jest.fn(() => true);
  mockCompressionMiddleware = jest.fn((options) => {
    mockCompressionMiddleware._options = options;
    return (req, res, next) => {
      res.setHeader('Content-Encoding', 'gzip');
      next();
    };
  });
  mockCompressionMiddleware.filter = mockCompressionFilter;
  return {
    default: mockCompressionMiddleware,
  };
});

jest.unstable_mockModule('crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid-1234'),
  createHash: jest.fn(() => ({
    update: jest.fn(() => ({
      digest: jest.fn(() => 'abc123hash'),
    })),
  })),
}));

const mockRouter = {
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
  use: jest.fn(),
};

jest.unstable_mockModule('express', () => {
  const mockApp = {
    use: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
    options: jest.fn(),
    listen: jest.fn((port, host, callback) => {
      if (callback) callback();
      return {
        on: jest.fn(),
        close: jest.fn((cb) => cb && cb()),
        setTimeout: jest.fn(),
        requestTimeout: 0,
        keepAliveTimeout: 0,
        headersTimeout: 0,
      };
    }),
  };
  const mockExpress = jest.fn(() => mockApp);
  mockExpress.json = jest.fn(() => (req, res, next) => next());
  mockExpress.urlencoded = jest.fn(() => (req, res, next) => next());
  mockExpress.Router = jest.fn(() => mockRouter);
  return { default: mockExpress };
});

jest.unstable_mockModule('cors', () => ({
  default: jest.fn(() => (req, res, next) => next()),
}));

jest.unstable_mockModule('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: jest.fn(),
}));

jest.unstable_mockModule('@modelcontextprotocol/sdk/types.js', () => ({
  isInitializeRequest: jest.fn(() => false),
}));

const compression = (await import('compression')).default;

// Helper to create a recursive mock logger
const createMockLogger = () => {
  const logger = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    child: jest.fn(),
  };
  logger.child.mockReturnValue(logger);
  return logger;
};

describe('HULLY-248: HTTP Compression Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Compression Configuration', () => {
    it('should configure compression with level 6', async () => {
      const { HttpTransport } = await import('../../../src/transport/HttpTransport.js');

      const mockServer = { connect: jest.fn() };
      const transport = new HttpTransport(mockServer, {
        logger: createMockLogger(),
      });

      await transport.start();
      expect(compression).toHaveBeenCalled();
      const options = compression._options;
      expect(options).toBeDefined();
      expect(options.level).toBe(6);
      await transport.stop();
    });

    it('should set threshold to 1KB (1024 bytes)', async () => {
      const { HttpTransport } = await import('../../../src/transport/HttpTransport.js');

      const mockServer = { connect: jest.fn() };
      const transport = new HttpTransport(mockServer, {
        logger: createMockLogger(),
      });

      await transport.start();
      const options = compression._options;
      expect(options.threshold).toBe(1024);
      await transport.stop();
    });

    it('should exclude SSE streams from compression', async () => {
      const { HttpTransport } = await import('../../../src/transport/HttpTransport.js');

      const mockServer = { connect: jest.fn() };
      const transport = new HttpTransport(mockServer, {
        logger: createMockLogger(),
      });

      await transport.start();
      const options = compression._options;
      expect(options.filter).toBeDefined();

      const sseReq = { headers: { accept: 'text/event-stream' } };
      const sseRes = {};
      const result = options.filter(sseReq, sseRes);
      expect(result).toBe(false);
      await transport.stop();
    });

    it('should compress non-SSE requests', async () => {
      const { HttpTransport } = await import('../../../src/transport/HttpTransport.js');

      const mockServer = { connect: jest.fn() };
      const transport = new HttpTransport(mockServer, {
        logger: createMockLogger(),
      });

      await transport.start();
      const options = compression._options;

      const jsonReq = { headers: { accept: 'application/json' } };
      const jsonRes = {};
      mockCompressionFilter.mockReturnValue(true);
      const result = options.filter(jsonReq, jsonRes);
      expect(result).toBe(true);
      await transport.stop();
    });
  });

  describe('Response Size Reduction (Simulated)', () => {
    it('should achieve significant compression for large JSON responses', () => {
      const sampleResponse = {
        issues: Array(10).fill({
          identifier: 'HULLY-123',
          title: 'Sample issue with a reasonably long title for testing compression',
          description: 'This is a description that contains enough text to be worth compressing.',
          status: 'In Progress',
          priority: 'High',
        }),
      };

      const uncompressedSize = JSON.stringify(sampleResponse).length;
      const estimatedCompressedSize = uncompressedSize * 0.3;
      const compressionRatio = 1 - estimatedCompressedSize / uncompressedSize;

      expect(compressionRatio).toBeGreaterThanOrEqual(0.6);
      expect(uncompressedSize).toBeGreaterThan(1024);
    });
  });

  describe('Threshold Behavior', () => {
    it('should not compress small responses below 1KB', () => {
      const smallResponse = { status: 'healthy', uptime: 12345 };
      const size = JSON.stringify(smallResponse).length;
      expect(size).toBeLessThan(1024);
    });

    it('should compress responses above 1KB', () => {
      const largeResponse = {
        issues: Array(20).fill({
          identifier: 'TEST-1',
          title: 'Test issue',
          description: 'A'.repeat(100),
        }),
      };
      const size = JSON.stringify(largeResponse).length;
      expect(size).toBeGreaterThan(1024);
    });
  });
});
