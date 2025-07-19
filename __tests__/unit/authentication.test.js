/**
 * Authentication & Connection Tests
 * 
 * Tests for Huly MCP Server authentication and connection functionality
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { MockHulyClient, mockConnect } from '../mocks/hulyClient.mock.js';

// Mock the Huly API client module
jest.mock('@hcengineering/api-client', () => ({
  connect: mockConnect
}));

// Import after mocking
let HulyMCPServer;

describe('Authentication & Connection Tests', () => {
  let server;
  let mockClient;
  
  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Reset environment variables
    process.env.HULY_URL = 'https://test.huly.io';
    process.env.HULY_EMAIL = 'test@example.com';
    process.env.HULY_PASSWORD = 'testpassword';
    process.env.HULY_WORKSPACE = 'testworkspace';
    
    // Create a new mock client
    mockClient = new MockHulyClient();
    mockConnect.mockResolvedValue(mockClient);
    
    // Dynamically import to get fresh module
    const module = await import('../../index.js');
    HulyMCPServer = module.HulyMCPServer;
    server = new HulyMCPServer();
  });
  
  afterEach(() => {
    // Clean up
    mockClient.reset();
  });
  
  describe('Successful Authentication', () => {
    test('should connect with valid credentials', async () => {
      const client = await server.connectToHuly();
      
      expect(client).toBeDefined();
      expect(mockConnect).toHaveBeenCalledWith('https://test.huly.io', {
        email: 'test@example.com',
        password: 'testpassword',
        workspace: 'testworkspace',
        socketFactory: expect.any(Function)
      });
      expect(mockClient.connected).toBe(true);
    });
    
    test('should reuse existing connection', async () => {
      // First connection
      const client1 = await server.connectToHuly();
      
      // Second connection attempt
      const client2 = await server.connectToHuly();
      
      // Should be the same instance
      expect(client1).toBe(client2);
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });
    
    test('should use default configuration when env vars not set', async () => {
      // Clear environment variables
      delete process.env.HULY_URL;
      delete process.env.HULY_EMAIL;
      delete process.env.HULY_PASSWORD;
      delete process.env.HULY_WORKSPACE;
      
      // Create new server instance to use defaults
      const module = await import('../../index.js');
      const newServer = new module.HulyMCPServer();
      
      await newServer.connectToHuly();
      
      expect(mockConnect).toHaveBeenCalledWith('https://pm.oculair.ca', {
        email: 'emanuvaderland@gmail.com',
        password: 'k2a8yy7sFWVZ6eL',
        workspace: 'agentspace',
        socketFactory: expect.any(Function)
      });
    });
  });
  
  describe('Authentication Failures', () => {
    test('should handle invalid credentials', async () => {
      mockConnect.mockRejectedValueOnce(new Error('Authentication failed: Invalid credentials'));
      
      await expect(server.connectToHuly()).rejects.toThrow('Authentication failed: Invalid credentials');
      expect(mockClient.connected).toBe(false);
    });
    
    test('should handle missing email', async () => {
      process.env.HULY_EMAIL = '';
      mockConnect.mockImplementationOnce(async (url, config) => {
        if (!config.email) {
          throw new Error('Authentication failed: Email is required');
        }
        return mockClient;
      });
      
      const module = await import('../../index.js');
      const newServer = new module.HulyMCPServer();
      
      await expect(newServer.connectToHuly()).rejects.toThrow('Authentication failed: Email is required');
    });
    
    test('should handle missing password', async () => {
      process.env.HULY_PASSWORD = '';
      mockConnect.mockImplementationOnce(async (url, config) => {
        if (!config.password) {
          throw new Error('Authentication failed: Password is required');
        }
        return mockClient;
      });
      
      const module = await import('../../index.js');
      const newServer = new module.HulyMCPServer();
      
      await expect(newServer.connectToHuly()).rejects.toThrow('Authentication failed: Password is required');
    });
    
    test('should handle workspace selection failure', async () => {
      mockConnect.mockRejectedValueOnce(new Error('Workspace not found: testworkspace'));
      
      await expect(server.connectToHuly()).rejects.toThrow('Workspace not found: testworkspace');
    });
  });
  
  describe('Connection Retry Logic', () => {
    test('should not automatically retry on connection failure', async () => {
      mockConnect.mockRejectedValueOnce(new Error('Network error'));
      
      await expect(server.connectToHuly()).rejects.toThrow('Network error');
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });
    
    test('should allow manual retry after failure', async () => {
      // First attempt fails
      mockConnect.mockRejectedValueOnce(new Error('Network error'));
      await expect(server.connectToHuly()).rejects.toThrow('Network error');
      
      // Reset mock to succeed
      mockConnect.mockResolvedValueOnce(mockClient);
      
      // Second attempt should succeed
      const client = await server.connectToHuly();
      expect(client).toBeDefined();
      expect(mockConnect).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('WebSocket Configuration', () => {
    test('should provide WebSocket factory in connection config', async () => {
      await server.connectToHuly();
      
      const callArgs = mockConnect.mock.calls[0][1];
      expect(callArgs.socketFactory).toBeDefined();
      expect(typeof callArgs.socketFactory).toBe('function');
      
      // Test that socketFactory creates a WebSocket instance
      const ws = callArgs.socketFactory('ws://test.url');
      expect(ws.constructor.name).toMatch(/WebSocket/);
    });
  });
  
  describe('Environment Variable Handling', () => {
    test('should handle special characters in password', async () => {
      process.env.HULY_PASSWORD = 'p@$$w0rd!#$%^&*()';
      
      const module = await import('../../index.js');
      const newServer = new module.HulyMCPServer();
      
      await newServer.connectToHuly();
      
      expect(mockConnect).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          password: 'p@$$w0rd!#$%^&*()'
        })
      );
    });
    
    test('should handle URL with trailing slash', async () => {
      process.env.HULY_URL = 'https://test.huly.io/';
      
      const module = await import('../../index.js');
      const newServer = new module.HulyMCPServer();
      
      await newServer.connectToHuly();
      
      expect(mockConnect).toHaveBeenCalledWith('https://test.huly.io/', expect.any(Object));
    });
  });
});