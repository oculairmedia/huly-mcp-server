/**
 * Error Handling Tests
 * 
 * Tests for Huly MCP Server error handling and error response formatting
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { MockHulyClient, mockConnect } from '../mocks/hulyClient.mock.js';

// Mock dependencies
jest.mock('@hcengineering/api-client', () => ({
  connect: mockConnect
}));

// Mock tracker module
jest.mock('@hcengineering/tracker', () => ({
  default: {
    class: {
      Project: { _class: 'tracker:class:Project' },
      Issue: { _class: 'tracker:class:Issue' }
    }
  }
}));

jest.mock('@hcengineering/core', () => ({
  generateId: jest.fn(),
  makeCollabJsonId: jest.fn(),
  makeCollabId: jest.fn()
}));

jest.mock('@hcengineering/rank', () => ({
  makeRank: jest.fn()
}));

describe('Error Handling Tests', () => {
  let server;
  let mockClient;
  let HulyError;
  let ERROR_CODES;
  
  beforeEach(async () => {
    jest.clearAllMocks();
    
    mockClient = new MockHulyClient();
    mockConnect.mockResolvedValue(mockClient);
    
    const module = await import('../../index.js');
    const HulyMCPServer = module.HulyMCPServer;
    HulyError = module.HulyError;
    ERROR_CODES = module.ERROR_CODES;
    
    server = new HulyMCPServer();
    await server.connectToHuly();
  });
  
  afterEach(() => {
    mockClient.reset();
  });
  
  describe('HulyError Class', () => {
    test('should create error with code and message', () => {
      const error = new HulyError(ERROR_CODES.ISSUE_NOT_FOUND, 'Issue not found');
      
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('HulyError');
      expect(error.code).toBe('ISSUE_NOT_FOUND');
      expect(error.message).toBe('Issue not found');
      expect(error.details).toEqual({});
    });
    
    test('should create error with details', () => {
      const error = new HulyError(
        ERROR_CODES.INVALID_FIELD,
        'Invalid field name',
        {
          field: 'unknown_field',
          context: 'Updating issue TEST-1',
          suggestion: 'Valid fields are: title, description, status, priority'
        }
      );
      
      expect(error.details.field).toBe('unknown_field');
      expect(error.details.context).toBe('Updating issue TEST-1');
      expect(error.details.suggestion).toContain('Valid fields are');
    });
    
    test('should format MCP response correctly', () => {
      const error = new HulyError(
        ERROR_CODES.DATABASE_ERROR,
        'Failed to connect to database',
        {
          context: 'Listing projects',
          suggestion: 'Check database connection settings'
        }
      );
      
      const response = error.toMCPResponse();
      
      expect(response.content).toHaveLength(1);
      expect(response.content[0].type).toBe('text');
      expect(response.content[0].text).toContain('❌ Error [DATABASE_ERROR]');
      expect(response.content[0].text).toContain('Failed to connect to database');
      expect(response.content[0].text).toContain('Context: Listing projects');
      expect(response.content[0].text).toContain('Suggestion: Check database connection settings');
    });
    
    test('should format MCP response without optional details', () => {
      const error = new HulyError(ERROR_CODES.UNKNOWN_ERROR, 'Something went wrong');
      const response = error.toMCPResponse();
      
      expect(response.content[0].text).toContain('❌ Error [UNKNOWN_ERROR]');
      expect(response.content[0].text).toContain('Something went wrong');
      expect(response.content[0].text).not.toContain('Context:');
      expect(response.content[0].text).not.toContain('Suggestion:');
    });
  });
  
  describe('Database Error Handling', () => {
    test('should handle connection errors gracefully', async () => {
      mockClient.findAll = jest.fn().mockRejectedValue(new Error('Connection refused'));
      
      const request = {
        method: 'tools/call',
        params: {
          name: 'huly_list_projects'
        }
      };
      
      const handler = server.server._requestHandlers.get('tools/call');
      const response = await handler(request);
      
      const text = response.content[0].text;
      expect(text).toContain('❌ Error [DATABASE_ERROR]');
      expect(text).toContain('Failed to list projects');
      expect(text).toContain('Connection refused');
    });
    
    test('should handle query timeout', async () => {
      mockClient.findAll = jest.fn().mockRejectedValue(new Error('Query timeout after 30000ms'));
      
      const request = {
        method: 'tools/call',
        params: {
          name: 'huly_list_issues',
          arguments: { project_identifier: 'TEST' }
        }
      };
      
      // Add test project
      mockClient.addMockProject({ identifier: 'TEST', _id: 'test-id' });
      
      const handler = server.server._requestHandlers.get('tools/call');
      const response = await handler(request);
      
      const text = response.content[0].text;
      expect(text).toContain('❌ Error [DATABASE_ERROR]');
      expect(text).toContain('Query timeout');
    });
    
    test('should handle permission errors', async () => {
      mockClient.create = jest.fn().mockRejectedValue(new Error('Permission denied: Cannot create issues'));
      
      const request = {
        method: 'tools/call',
        params: {
          name: 'huly_create_issue',
          arguments: {
            project_identifier: 'TEST',
            title: 'Test Issue'
          }
        }
      };
      
      // Add test project
      mockClient.addMockProject({ identifier: 'TEST', _id: 'test-id' });
      
      const handler = server.server._requestHandlers.get('tools/call');
      const response = await handler(request);
      
      const text = response.content[0].text;
      expect(text).toContain('❌ Error [DATABASE_ERROR]');
      expect(text).toContain('Permission denied');
    });
  });
  
  describe('Network Error Handling', () => {
    test('should handle network disconnection during operation', async () => {
      let callCount = 0;
      mockClient.findAll = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call succeeds
          return Promise.resolve([]);
        } else {
          // Subsequent calls fail
          return Promise.reject(new Error('Network disconnected'));
        }
      });
      
      const request1 = {
        method: 'tools/call',
        params: { name: 'huly_list_projects' }
      };
      
      const handler = server.server._requestHandlers.get('tools/call');
      
      // First call should succeed
      const response1 = await handler(request1);
      expect(response1.content[0].text).toContain('No projects found');
      
      // Second call should fail
      const response2 = await handler(request1);
      expect(response2.content[0].text).toContain('❌ Error [DATABASE_ERROR]');
      expect(response2.content[0].text).toContain('Network disconnected');
    });
    
    test('should handle WebSocket errors', async () => {
      // Simulate WebSocket error during connection
      mockConnect.mockRejectedValueOnce(new Error('WebSocket connection failed: ECONNREFUSED'));
      
      // Force reconnection
      server.hulyClient = null;
      
      const request = {
        method: 'tools/call',
        params: { name: 'huly_list_projects' }
      };
      
      const handler = server.server._requestHandlers.get('tools/call');
      const response = await handler(request);
      
      const text = response.content[0].text;
      expect(text).toContain('❌ Error [CONNECTION_ERROR]');
      expect(text).toContain('Failed to connect to Huly');
    });
  });
  
  describe('MCP Error Response Formatting', () => {
    test('should format validation errors properly', async () => {
      const request = {
        method: 'tools/call',
        params: {
          name: 'huly_create_issue',
          arguments: {
            project_identifier: 'TEST',
            title: '',  // Empty title
            priority: 'invalid'  // Invalid priority
          }
        }
      };
      
      mockClient.addMockProject({ identifier: 'TEST', _id: 'test-id' });
      
      const handler = server.server._requestHandlers.get('tools/call');
      const response = await handler(request);
      
      const text = response.content[0].text;
      expect(text).toContain('❌ Error');
      expect(text).toContain('VALIDATION_ERROR');
      // Should catch the first validation error
      expect(text.match(/❌ Error/g)).toHaveLength(1);
    });
    
    test('should handle unexpected errors gracefully', async () => {
      // Simulate an unexpected error
      mockClient.findAll = jest.fn().mockImplementation(() => {
        throw new TypeError('Cannot read property of undefined');
      });
      
      const request = {
        method: 'tools/call',
        params: { name: 'huly_list_projects' }
      };
      
      const handler = server.server._requestHandlers.get('tools/call');
      const response = await handler(request);
      
      const text = response.content[0].text;
      expect(text).toContain('❌ Error [DATABASE_ERROR]');
      expect(text).toContain('Failed to list projects');
      expect(text).toContain('Cannot read property of undefined');
    });
    
    test('should provide helpful suggestions for common errors', async () => {
      const request = {
        method: 'tools/call',
        params: {
          name: 'huly_update_issue',
          arguments: {
            issue_identifier: 'INVALID',  // Invalid format
            field: 'title',
            value: 'New Title'
          }
        }
      };
      
      const handler = server.server._requestHandlers.get('tools/call');
      const response = await handler(request);
      
      const text = response.content[0].text;
      expect(text).toContain('❌ Error [VALIDATION_ERROR]');
      expect(text).toContain('Invalid issue identifier format');
      expect(text).toContain('Expected format: PROJECT-NUMBER');
    });
  });
  
  describe('Error Recovery', () => {
    test('should recover from transient errors', async () => {
      let callCount = 0;
      mockClient.findAll = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Temporary network error'));
        } else {
          return Promise.resolve([]);
        }
      });
      
      const request = {
        method: 'tools/call',
        params: { name: 'huly_list_projects' }
      };
      
      const handler = server.server._requestHandlers.get('tools/call');
      
      // First call fails
      const response1 = await handler(request);
      expect(response1.content[0].text).toContain('❌ Error');
      
      // Second call succeeds
      const response2 = await handler(request);
      expect(response2.content[0].text).toContain('No projects found');
    });
    
    test('should maintain state after errors', async () => {
      // Create a project successfully
      const createRequest = {
        method: 'tools/call',
        params: {
          name: 'huly_create_project',
          arguments: {
            name: 'Test Project',
            identifier: 'TEST'
          }
        }
      };
      
      const handler = server.server._requestHandlers.get('tools/call');
      await handler(createRequest);
      
      // Simulate an error
      mockClient.findAll = jest.fn().mockRejectedValueOnce(new Error('Temporary error'));
      
      const listRequest = {
        method: 'tools/call',
        params: { name: 'huly_list_projects' }
      };
      
      // This should fail
      const errorResponse = await handler(listRequest);
      expect(errorResponse.content[0].text).toContain('❌ Error');
      
      // Reset mock to work normally
      mockClient.findAll = jest.fn().mockImplementation((classRef) => {
        return Promise.resolve(mockClient.mockData.projects);
      });
      
      // This should succeed and show the project
      const successResponse = await handler(listRequest);
      expect(successResponse.content[0].text).toContain('Test Project');
    });
  });
});