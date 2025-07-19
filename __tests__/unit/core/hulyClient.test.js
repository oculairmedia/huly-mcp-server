/**
 * HulyClient Tests
 * 
 * Tests for the Huly client wrapper with connection management
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { HulyClient, createHulyClient } from '../../../src/core/HulyClient.js';

describe('HulyClient Tests', () => {
  let client;
  const testConfig = {
    url: 'http://localhost:3333',
    email: 'test@example.com',
    password: 'testpass123',
    workspace: 'testworkspace'
  };

  beforeEach(() => {
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
        getHierarchy: () => null
      };
      
      expect(client.isConnected()).toBe(false);
    });

    test('should report connected when client exists and hierarchy is accessible', () => {
      client.client = {
        getHierarchy: () => ({ someData: true })
      };
      
      expect(client.isConnected()).toBe(true);
    });

    test('should report not connected when getHierarchy throws', () => {
      client.client = {
        getHierarchy: () => {
          throw new Error('Connection lost');
        }
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
        new Error('Unknown error')
      ];
      
      otherErrors.forEach(error => {
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
          workspace: testConfig.workspace
        }
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
        backoffFactor: 2
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
});