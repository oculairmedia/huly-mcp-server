/**
 * Project Management Tests
 * 
 * Tests for Huly MCP Server project management functionality
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { MockHulyClient, mockConnect } from '../mocks/hulyClient.mock.js';

// Mock dependencies
jest.mock('@hcengineering/api-client', () => ({
  connect: mockConnect
}));

// Mock tracker module classes
const mockTrackerClasses = {
  class: {
    Project: { _class: 'tracker:class:Project' }
  }
};

jest.mock('@hcengineering/tracker', () => ({
  default: mockTrackerClasses
}));

// Mock core module
jest.mock('@hcengineering/core', () => ({
  generateId: jest.fn(() => `generated-${Date.now()}`),
  makeCollabJsonId: jest.fn(),
  makeCollabId: jest.fn()
}));

// Mock rank module
jest.mock('@hcengineering/rank', () => ({
  makeRank: jest.fn(() => '0|hzzzzz:')
}));

describe('Project Management Tests', () => {
  let server;
  let mockClient;
  let mockRequest;
  
  beforeEach(async () => {
    jest.clearAllMocks();
    
    mockClient = new MockHulyClient();
    mockConnect.mockResolvedValue(mockClient);
    
    const module = await import('../../index.js');
    const HulyMCPServer = module.HulyMCPServer;
    server = new HulyMCPServer();
    
    // Pre-connect the server
    await server.connectToHuly();
    
    // Mock request handler
    mockRequest = {
      method: 'tools/call',
      params: {}
    };
  });
  
  afterEach(() => {
    mockClient.reset();
  });
  
  describe('List Projects', () => {
    beforeEach(() => {
      mockRequest.params.name = 'huly_list_projects';
    });
    
    test('should list all projects successfully', async () => {
      // Add mock projects
      mockClient.addMockProject({
        _id: 'project1',
        name: 'Test Project 1',
        identifier: 'TP1',
        description: 'First test project'
      });
      
      mockClient.addMockProject({
        _id: 'project2',
        name: 'Test Project 2',
        identifier: 'TP2',
        description: 'Second test project'
      });
      
      const handler = server.server._requestHandlers.get('tools/call');
      const response = await handler(mockRequest);
      
      expect(response.content).toHaveLength(1);
      expect(response.content[0].type).toBe('text');
      
      const text = response.content[0].text;
      expect(text).toContain('Found 2 projects');
      expect(text).toContain('Test Project 1 (TP1)');
      expect(text).toContain('Test Project 2 (TP2)');
      expect(text).toContain('First test project');
      expect(text).toContain('Second test project');
    });
    
    test('should handle empty project list', async () => {
      const handler = server.server._requestHandlers.get('tools/call');
      const response = await handler(mockRequest);
      
      expect(response.content[0].text).toContain('No projects found');
    });
    
    test('should handle projects without descriptions', async () => {
      mockClient.addMockProject({
        _id: 'project1',
        name: 'No Description Project',
        identifier: 'NDP'
      });
      
      const handler = server.server._requestHandlers.get('tools/call');
      const response = await handler(mockRequest);
      
      const text = response.content[0].text;
      expect(text).toContain('No Description Project (NDP)');
      expect(text).toContain('No description');
    });
    
    test('should handle database errors gracefully', async () => {
      mockClient.findAll = jest.fn().mockRejectedValue(new Error('Database connection failed'));
      
      const handler = server.server._requestHandlers.get('tools/call');
      const response = await handler(mockRequest);
      
      const text = response.content[0].text;
      expect(text).toContain('Error');
      expect(text).toContain('DATABASE_ERROR');
      expect(text).toContain('Failed to list projects');
    });
  });
  
  describe('Create Project', () => {
    beforeEach(() => {
      mockRequest.params.name = 'huly_create_project';
    });
    
    test('should create project with all fields', async () => {
      mockRequest.params.arguments = {
        name: 'New Test Project',
        identifier: 'NTP',
        description: 'A brand new test project'
      };
      
      const handler = server.server._requestHandlers.get('tools/call');
      const response = await handler(mockRequest);
      
      // Verify the project was created
      expect(mockClient.calls.create).toHaveLength(1);
      const createCall = mockClient.calls.create[0];
      expect(createCall.data.name).toBe('New Test Project');
      expect(createCall.data.identifier).toBe('NTP');
      expect(createCall.data.description).toBe('A brand new test project');
      
      // Check response
      const text = response.content[0].text;
      expect(text).toContain('Successfully created project');
      expect(text).toContain('New Test Project');
      expect(text).toContain('NTP');
    });
    
    test('should create project with minimal fields', async () => {
      mockRequest.params.arguments = {
        name: 'Minimal Project'
      };
      
      const handler = server.server._requestHandlers.get('tools/call');
      const response = await handler(mockRequest);
      
      // Verify auto-generated identifier
      const createCall = mockClient.calls.create[0];
      expect(createCall.data.name).toBe('Minimal Project');
      expect(createCall.data.identifier).toMatch(/^MP[0-9]+$/);
      expect(createCall.data.description).toBe('');
      
      const text = response.content[0].text;
      expect(text).toContain('Successfully created project');
      expect(text).toContain('Minimal Project');
    });
    
    test('should validate identifier length', async () => {
      mockRequest.params.arguments = {
        name: 'Test Project',
        identifier: 'TOOLONG'
      };
      
      const handler = server.server._requestHandlers.get('tools/call');
      const response = await handler(mockRequest);
      
      const text = response.content[0].text;
      expect(text).toContain('Error');
      expect(text).toContain('VALIDATION_ERROR');
      expect(text).toContain('must be 1-5 characters');
    });
    
    test('should validate identifier format', async () => {
      mockRequest.params.arguments = {
        name: 'Test Project',
        identifier: 'T-1'
      };
      
      const handler = server.server._requestHandlers.get('tools/call');
      const response = await handler(mockRequest);
      
      const text = response.content[0].text;
      expect(text).toContain('Error');
      expect(text).toContain('VALIDATION_ERROR');
      expect(text).toContain('must contain only alphanumeric characters');
    });
    
    test('should handle duplicate identifier', async () => {
      // Add existing project
      mockClient.addMockProject({
        name: 'Existing Project',
        identifier: 'TEST'
      });
      
      mockRequest.params.arguments = {
        name: 'New Project',
        identifier: 'TEST'
      };
      
      // Mock the create to fail with duplicate error
      mockClient.create = jest.fn().mockRejectedValue(new Error('Duplicate identifier'));
      
      const handler = server.server._requestHandlers.get('tools/call');
      const response = await handler(mockRequest);
      
      const text = response.content[0].text;
      expect(text).toContain('Error');
      expect(text).toContain('DATABASE_ERROR');
    });
    
    test('should sanitize project name', async () => {
      mockRequest.params.arguments = {
        name: '  Test Project  ',
        identifier: 'TP'
      };
      
      const handler = server.server._requestHandlers.get('tools/call');
      await handler(mockRequest);
      
      const createCall = mockClient.calls.create[0];
      expect(createCall.data.name).toBe('Test Project');
    });
    
    test('should generate unique identifier from name', async () => {
      mockRequest.params.arguments = {
        name: 'Very Long Project Name Here'
      };
      
      const handler = server.server._requestHandlers.get('tools/call');
      const response = await handler(mockRequest);
      
      const createCall = mockClient.calls.create[0];
      expect(createCall.data.identifier).toMatch(/^VLPNH[0-9]+$/);
      
      const text = response.content[0].text;
      expect(text).toContain('VLPNH');
    });
  });
  
  describe('Project Query Edge Cases', () => {
    test('should handle network timeout', async () => {
      mockClient.findAll = jest.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Network timeout')), 100);
        });
      });
      
      mockRequest.params.name = 'huly_list_projects';
      
      const handler = server.server._requestHandlers.get('tools/call');
      const response = await handler(mockRequest);
      
      const text = response.content[0].text;
      expect(text).toContain('Error');
      expect(text).toContain('DATABASE_ERROR');
    });
    
    test('should handle malformed project data', async () => {
      // Add project with missing required fields
      mockClient.mockData.projects.push({
        _id: 'malformed',
        // Missing name and identifier
      });
      
      mockRequest.params.name = 'huly_list_projects';
      
      const handler = server.server._requestHandlers.get('tools/call');
      const response = await handler(mockRequest);
      
      const text = response.content[0].text;
      // Should skip malformed project or show with defaults
      expect(text).toMatch(/Found [0-9]+ project/);
    });
  });
});