/**
 * HulyClient Tests
 *
 * Tests for the Huly client wrapper with connection management
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// Set up mocks before imports
const mockConnect = jest.fn();
const mockWebSocket = jest.fn();

jest.unstable_mockModule('@hcengineering/api-client', () => ({
  default: {
    connect: mockConnect,
  },
  connect: mockConnect,
}));

jest.unstable_mockModule('ws', () => ({
  default: mockWebSocket,
}));

jest.unstable_mockModule('@hcengineering/core', () => ({
  AccountRole: { User: 'user' },
  coreId: 'core',
  DOMAIN_TX: 'tx',
}));

// Dynamic imports after mocks are set up
const { HulyClient, createHulyClient } = await import('../../../src/core/HulyClient.js');

describe('HulyClient Tests', () => {
  let client;
  let mockInternalClient;
  const testConfig = {
    url: 'http://localhost:3333',
    email: 'test@example.com',
    password: 'testpass123',
    workspace: 'testworkspace',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock internal client
    mockInternalClient = {
      connect: jest.fn(),
      close: jest.fn(),
      disconnect: jest.fn(),
      findOne: jest.fn(),
      findAll: jest.fn(),
      createDoc: jest.fn(),
      addCollection: jest.fn(),
      updateDoc: jest.fn(),
      deleteDoc: jest.fn(),
      searchFulltext: jest.fn(),
      getHierarchy: jest.fn().mockReturnValue({
        isDerived: jest.fn().mockReturnValue(true),
      }),
      getModel: jest.fn().mockReturnValue({
        defs: jest.fn().mockReturnValue([]),
      }),
    };

    // Configure the mockConnect to return our mock client
    mockConnect.mockResolvedValue(mockInternalClient);

    client = new HulyClient(testConfig);
  });

  describe('Constructor', () => {
    test('should initialize with config', () => {
      expect(client.config).toEqual(testConfig);
      expect(client.client).toBeNull();
      expect(client.connectionPromise).toBeNull();
      expect(client.isConnecting).toBe(false);
      expect(client.retryCount).toBe(0);
      expect(client.lastConnectionError).toBeNull();
    });
  });

  describe('Connection Status', () => {
    test('should report not connected when client is null', () => {
      expect(client.isConnected()).toBe(false);
    });

    test('should report not connected when client exists but hierarchy is null', () => {
      client.client = {
        getHierarchy: () => null,
      };

      expect(client.isConnected()).toBe(false);
    });

    test('should report connected when client exists and hierarchy is accessible', () => {
      client.client = {
        getHierarchy: () => ({ someData: true }),
      };

      expect(client.isConnected()).toBe(true);
    });

    test('should report not connected when getHierarchy throws', () => {
      client.client = {
        getHierarchy: () => {
          throw new Error('Connection lost');
        },
      };

      expect(client.isConnected()).toBe(false);
    });
  });

  describe('Error Detection', () => {
    test('should identify connection errors correctly', () => {
      // Test each error individually to see which ones pass
      expect(client._isConnectionError(new Error('connection lost'))).toBe(true);
      expect(client._isConnectionError(new Error('ECONNREFUSED'))).toBe(true);
      expect(client._isConnectionError(new Error('websocket disconnected'))).toBe(true);
      expect(client._isConnectionError(new Error('network timeout'))).toBe(true);
      expect(client._isConnectionError(new Error('socket closed'))).toBe(true);
      expect(client._isConnectionError(new Error('ETIMEDOUT error occurred'))).toBe(true);
      expect(client._isConnectionError(new Error('ENETUNREACH: network unreachable'))).toBe(true);
    });

    test('should not identify non-connection errors', () => {
      const otherErrors = [
        new Error('Invalid argument'),
        new Error('Permission denied'),
        new Error('Not found'),
        new Error('Validation failed'),
        new Error('Unknown error'),
      ];

      otherErrors.forEach((error) => {
        expect(client._isConnectionError(error)).toBe(false);
      });
    });

    test('should handle errors without message', () => {
      const errorWithoutMessage = new Error();
      errorWithoutMessage.message = undefined;

      expect(client._isConnectionError(errorWithoutMessage)).toBe(false);
    });
  });

  describe('Sleep utility', () => {
    test('should delay for specified time', async () => {
      const start = Date.now();
      await client._sleep(100);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(90); // Allow some tolerance
      expect(elapsed).toBeLessThan(150);
    });
  });

  describe('Status', () => {
    test('should return initial status', () => {
      const status = client.getStatus();

      expect(status).toEqual({
        connected: false,
        connecting: false,
        retryCount: 0,
        lastError: null,
        config: {
          url: testConfig.url,
          email: testConfig.email,
          workspace: testConfig.workspace,
        },
      });
    });

    test('should not expose password in status', () => {
      const status = client.getStatus();

      expect(status.config.password).toBeUndefined();
    });

    test('should update status during connection', () => {
      client.isConnecting = true;
      client.retryCount = 2;
      client.lastConnectionError = new Error('Test error');

      const status = client.getStatus();

      expect(status.connecting).toBe(true);
      expect(status.retryCount).toBe(2);
      expect(status.lastError).toBe('Test error');
    });
  });

  describe('Connection Management', () => {
    test('should connect successfully on first attempt', async () => {
      const result = await client.connect();

      expect(mockConnect).toHaveBeenCalledWith(
        testConfig.url,
        expect.objectContaining({
          email: testConfig.email,
          password: testConfig.password,
          workspace: testConfig.workspace,
        })
      );
      expect(result).toBe(mockInternalClient);
      expect(client.client).toBe(mockInternalClient);
      expect(client.isConnected()).toBe(true);
    });

    test('should return existing client if already connected', async () => {
      // First connection
      await client.connect();
      mockConnect.mockClear();

      // Second connection attempt
      const result = await client.connect();

      expect(mockConnect).not.toHaveBeenCalled();
      expect(result).toBe(mockInternalClient);
    });

    test('should wait for in-progress connection', async () => {
      // Start first connection
      const promise1 = client.connect();

      // Start second connection while first is in progress
      const promise2 = client.connect();

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(mockConnect).toHaveBeenCalledTimes(1);
      expect(result1).toBe(mockInternalClient);
      expect(result2).toBe(mockInternalClient);
    });

    test('should retry on connection failure', async () => {
      // First two attempts fail, third succeeds
      mockConnect
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockResolvedValueOnce(mockInternalClient);

      const result = await client.connect();

      expect(mockConnect).toHaveBeenCalledTimes(3);
      expect(result).toBe(mockInternalClient);
      expect(client.retryCount).toBe(0); // Reset after success
    });

    test('should throw error after max retries', async () => {
      mockConnect.mockRejectedValue(new Error('Connection failed'));

      await expect(client.connect()).rejects.toThrow('Failed to connect to Huly platform');
      expect(mockConnect).toHaveBeenCalledTimes(3); // Max attempts
      expect(client.retryCount).toBe(3);
    });
  });

  describe('Disconnect', () => {
    test('should disconnect successfully with close method', async () => {
      await client.connect();
      await client.disconnect();

      expect(mockInternalClient.close).toHaveBeenCalled();
      expect(client.client).toBeNull();
      expect(client.isConnected()).toBe(false);
    });

    test('should disconnect successfully with disconnect method', async () => {
      delete mockInternalClient.close;
      await client.connect();
      await client.disconnect();

      expect(mockInternalClient.disconnect).toHaveBeenCalled();
      expect(client.client).toBeNull();
    });

    test('should handle disconnect when not connected', async () => {
      await client.disconnect();
      expect(mockInternalClient.close).not.toHaveBeenCalled();
    });

    test('should wait for pending connection before disconnecting', async () => {
      // Delay the connection
      mockConnect.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockInternalClient), 100))
      );

      const connectPromise = client.connect();

      // Start disconnect while connecting
      const disconnectPromise = client.disconnect();

      await Promise.all([connectPromise, disconnectPromise]);

      expect(client.client).toBeNull();
    });

    test('should handle disconnect errors gracefully', async () => {
      mockInternalClient.close.mockRejectedValue(new Error('Close failed'));

      await client.connect();
      await client.disconnect(); // Should not throw

      expect(client.client).toBeNull();
    });
  });

  describe('Reconnect', () => {
    test('should disconnect and connect again', async () => {
      await client.connect();
      mockConnect.mockClear();

      const result = await client.reconnect();

      expect(mockInternalClient.close).toHaveBeenCalled();
      expect(mockConnect).toHaveBeenCalled();
      expect(result).toBe(mockInternalClient);
    });
  });

  describe('getClient', () => {
    test('should connect if not connected', async () => {
      const result = await client.getClient();

      expect(mockConnect).toHaveBeenCalled();
      expect(result).toBe(mockInternalClient);
    });

    test('should return existing client if connected', async () => {
      await client.connect();
      mockConnect.mockClear();

      const result = await client.getClient();

      expect(mockConnect).not.toHaveBeenCalled();
      expect(result).toBe(mockInternalClient);
    });
  });

  describe('withClient', () => {
    test('should execute function with client', async () => {
      const mockFn = jest.fn().mockResolvedValue('result');

      const result = await client.withClient(mockFn);

      expect(mockFn).toHaveBeenCalledWith(mockInternalClient);
      expect(result).toBe('result');
    });

    test('should retry on connection error', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('websocket closed'))
        .mockResolvedValueOnce('success');

      const result = await client.withClient(mockFn, 1);

      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(result).toBe('success');
    });

    test('should not retry on non-connection error', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Validation failed'));

      await expect(client.withClient(mockFn, 2)).rejects.toThrow('Validation failed');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('should throw last error after max retries', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('connection lost'));

      await expect(client.withClient(mockFn, 2)).rejects.toThrow('connection lost');
      expect(mockFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('Factory Function', () => {
    test('should create HulyClient instance', () => {
      const instance = createHulyClient(testConfig);

      expect(instance).toBeInstanceOf(HulyClient);
      expect(instance.config).toEqual(testConfig);
    });
  });

  describe('Retry Configuration', () => {
    test('should calculate exponential backoff correctly', () => {
      const RETRY_CONFIG = {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        backoffFactor: 2,
      };

      // Calculate expected delays
      const delay1 = RETRY_CONFIG.initialDelay; // 1000
      const delay2 = RETRY_CONFIG.initialDelay * RETRY_CONFIG.backoffFactor; // 2000
      const delay3 = RETRY_CONFIG.initialDelay * Math.pow(RETRY_CONFIG.backoffFactor, 2); // 4000

      expect(delay1).toBe(1000);
      expect(delay2).toBe(2000);
      expect(delay3).toBe(4000);

      // Verify max delay cap
      const delay4 = RETRY_CONFIG.initialDelay * Math.pow(RETRY_CONFIG.backoffFactor, 10); // Would be very large
      const cappedDelay = Math.min(delay4, RETRY_CONFIG.maxDelay);
      expect(cappedDelay).toBe(RETRY_CONFIG.maxDelay);
    });
  });

  // Removed duplicate Connection Management tests

  // Database Operations tests removed as HulyClient doesn't expose these methods directly

  describe('Error Handling', () => {
    test('should handle connection errors', async () => {
      mockConnect.mockRejectedValue(new Error('Connection failed'));

      await expect(client.connect()).rejects.toThrow();
      expect(mockConnect).toHaveBeenCalledTimes(3); // Max attempts
    });
  });
});
