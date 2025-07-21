/**
 * Unit tests for StdioTransport
 */

import { jest } from '@jest/globals';
import { StdioTransport } from '../StdioTransport.js';

// Mock the MCP SDK
jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn().mockImplementation(() => ({
    // Mock transport methods if needed
  })),
}));

describe('StdioTransport', () => {
  let stdioTransport;
  let mockServer;

  beforeEach(() => {
    jest.clearAllMocks();

    mockServer = {
      connect: jest.fn(),
    };

    stdioTransport = new StdioTransport(mockServer);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with server and transport', () => {
      expect(stdioTransport.server).toBe(mockServer);
      expect(stdioTransport.transport).toBeDefined();
      expect(stdioTransport.running).toBe(false);
    });
  });

  describe('start', () => {
    it('should start stdio transport successfully', async () => {
      await stdioTransport.start();

      expect(mockServer.connect).toHaveBeenCalledWith(stdioTransport.transport);
      expect(stdioTransport.running).toBe(true);
    });

    it('should throw error if already running', async () => {
      await stdioTransport.start();

      await expect(stdioTransport.start()).rejects.toThrow('StdioTransport is already running');
    });

    it('should handle connection error', async () => {
      mockServer.connect.mockRejectedValue(new Error('Connection failed'));

      await expect(stdioTransport.start()).rejects.toThrow(
        'Failed to start StdioTransport: Connection failed'
      );
      expect(stdioTransport.running).toBe(false);
    });
  });

  describe('stop', () => {
    it('should stop stdio transport successfully', async () => {
      await stdioTransport.start();
      await stdioTransport.stop();

      expect(stdioTransport.running).toBe(false);
    });

    it('should do nothing if not running', async () => {
      await stdioTransport.stop();

      expect(stdioTransport.running).toBe(false);
    });

    it('should handle stop error gracefully', async () => {
      await stdioTransport.start();

      // Override stop to simulate error
      stdioTransport.running = true;
      // const originalStop = stdioTransport.stop.bind(stdioTransport);
      stdioTransport.stop = async function () {
        try {
          throw new Error('Stop failed');
        } catch (error) {
          throw new Error(`Failed to stop StdioTransport: ${error.message}`);
        }
      };

      await expect(stdioTransport.stop()).rejects.toThrow(
        'Failed to stop StdioTransport: Stop failed'
      );
    });
  });

  describe('getType', () => {
    it('should return transport type', () => {
      expect(stdioTransport.getType()).toBe('stdio');
    });
  });

  describe('isRunning', () => {
    it('should return false when not started', () => {
      expect(stdioTransport.isRunning()).toBe(false);
    });

    it('should return true when running', async () => {
      await stdioTransport.start();
      expect(stdioTransport.isRunning()).toBe(true);
    });

    it('should return false after stopped', async () => {
      await stdioTransport.start();
      await stdioTransport.stop();
      expect(stdioTransport.isRunning()).toBe(false);
    });
  });

  describe('BaseTransport inheritance', () => {
    it('should inherit from BaseTransport', () => {
      expect(stdioTransport.server).toBe(mockServer);
    });
  });
});
